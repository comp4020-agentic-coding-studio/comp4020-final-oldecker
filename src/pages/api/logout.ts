import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { currentPerson, endSession } from "../../lib/identity";

export const prerender = false;

// POST only: a GET that logs you out could be triggered by any <img> tag on
// any page. Ends this browser's session only --- other devices stay logged in.
export const POST: APIRoute = async ({ cookies, redirect }) => {
  const person = currentPerson(cookies);
  endSession(cookies);
  if (person) logAction(person, "logout", `name=${person.name}`);
  return redirect("/login", 303);
};
