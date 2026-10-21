import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { cleanName, createAccount, nameTaken, startSession, validateName, validatePassword } from "../../lib/identity";
import { parseSignupAvatar } from "../../lib/signup-avatar";

export const prerender = false;

// Presence itself is keyed off an open /api/events connection, not off
// signing up --- a fresh account has no open stream yet, so there's nothing
// to broadcast here. The client connects to /api/events right after this
// redirect, and *that* connection is what announces presence.
//
// Failures redirect back to /signup?error=<code> instead of answering a bare
// 400, so the form can show the problem inline. The password is never put in
// the URL; the name and avatar are, so the person doesn't have to retype them.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const name = cleanName(String(form.get("name") ?? ""));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const avatar = parseSignupAvatar(form);

  const back = (error: string) => {
    const q = new URLSearchParams({ error, name });
    if (avatar) q.set("avatar", avatar);
    return redirect(`/signup?${q}`, 303);
  };

  if (validateName(name)) return back("name-invalid");
  if (validatePassword(password)) return back("password-invalid");
  if (password !== confirm) return back("password-mismatch");
  if (!avatar) return back("avatar-invalid");
  if (nameTaken(name)) return back("name-taken");

  const person = await createAccount(name, password, avatar);
  if (!person) return back("name-taken"); // lost a race for the same name

  startSession(cookies, person.id);
  logAction(person, "person_signup", `name=${name} avatar=${avatar}`);
  return redirect("/", 303);
};
