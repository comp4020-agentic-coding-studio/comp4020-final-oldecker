import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { logAction } from "../../lib/audit";
import { db } from "../../lib/db";
import { safeNext } from "../../lib/houses";
import { cleanName, MAX_PASSWORD_LENGTH, nameKeyOf, startSession } from "../../lib/identity";
import { dummyVerify, verifyPassword } from "../../lib/password";
import { checkLogin, recordFailedLogin, recordSuccessfulLogin } from "../../lib/ratelimit";
import { people } from "../../lib/schema";

export const prerender = false;

// Wrong name and wrong password give the same answer (and take the same
// time, see dummyVerify), so this can't be used to find out who has an
// account. Failed attempts are rate-limited per name and per IP, see
// src/lib/ratelimit.ts.
export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const form = await request.formData();
  const name = cleanName(String(form.get("name") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const nameKey = nameKeyOf(name);
  // Fly's proxy sets Fly-Client-IP (and overwrites any client-sent copy);
  // the socket address is only ever the proxy there, so it's the fallback
  // for local runs.
  const ip = request.headers.get("fly-client-ip") ?? clientAddress ?? "unknown";

  const back = (error: string, extra?: Record<string, string>) =>
    redirect(`/login?${new URLSearchParams({ error, name, ...(next ? { next } : {}), ...extra })}`, 303);

  const gate = checkLogin(nameKey, ip);
  if (!gate.allowed) {
    logAction(null, "login_blocked", `name=${name} ip=${ip}`);
    return back("rate-limited", { wait: String(Math.ceil(gate.retryAfterSeconds / 60)) });
  }

  // Cap the length we'll hash: anything longer than validatePassword allows
  // can't be a real password, so don't spend scrypt on it.
  const account = name
    ? db.select().from(people).where(eq(people.nameKey, nameKey)).get()
    : undefined;
  const ok =
    account?.passwordHash && password.length <= MAX_PASSWORD_LENGTH
      ? await verifyPassword(password, account.passwordHash)
      : await dummyVerify(password.slice(0, MAX_PASSWORD_LENGTH)).then(() => false);

  if (!account || !ok) {
    recordFailedLogin(nameKey, ip);
    // the attempted name is logged; the password never is
    logAction(null, "login_failed", `name=${name} ip=${ip}`);
    return back("bad-credentials");
  }

  recordSuccessfulLogin(nameKey);
  startSession(cookies, account.id);
  logAction(account, "login", `name=${account.name}`);
  // "/" forwards on to your last house (or the street); an invite or house
  // link that sent you to log in first sends you back there instead.
  return redirect(safeNext(next) ?? "/", 303);
};
