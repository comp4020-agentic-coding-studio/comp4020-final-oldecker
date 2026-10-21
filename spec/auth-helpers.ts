// Shared by the spec files that need a logged-in person. Posts the same
// form-encoded body a browser's signup form does (Astro's origin check only
// covers form-like POSTs, so the Origin header matters).
export const PASSWORD = "correct horse battery";

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function formPost(
  baseUrl: string,
  path: string,
  fields: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    origin: new URL(baseUrl).origin,
  };
  if (cookie) headers.cookie = cookie;
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers,
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
}

// "name=value" for the session cookie in a response, or null if it set none
// (or cleared it).
export function sessionCookieOf(res: Response): string | null {
  const header = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!header) return null;
  const pair = header.split(";")[0];
  return pair === "session=" ? null : pair;
}

// Signs up a new person and returns their session cookie ("session=...").
export async function signup(baseUrl: string, name: string, avatar = "bunyip"): Promise<string> {
  const res = await formPost(baseUrl, "/api/signup", {
    name,
    password: PASSWORD,
    confirm: PASSWORD,
    avatar,
  });
  if (res.status !== 303 || res.headers.get("location") !== "/") {
    throw new Error(`signup should redirect to the board, got ${res.status} ${res.headers.get("location")}`);
  }
  const cookie = sessionCookieOf(res);
  if (!cookie) throw new Error("signup did not set a session cookie");
  return cookie;
}
