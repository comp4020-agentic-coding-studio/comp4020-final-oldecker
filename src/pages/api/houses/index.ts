import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { cleanHouseName, createHouse, setLastHouse, validateHouseName } from "../../../lib/houses";
import { currentPerson } from "../../../lib/identity";

export const prerender = false;

// Build a new house. Anyone logged in can; the builder is its first member.
// Form-encoded like every mutation here (Astro's origin check only covers
// form-like or bodyless POSTs). Errors bounce back to the street page with a
// code, not free text, same as /signup's.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return new Response("expected a form-encoded body", { status: 400 });
  const name = cleanHouseName(String(form.get("name") ?? ""));

  const back = (error: string) => redirect(`/houses?${new URLSearchParams({ error, name })}`, 303);
  if (validateHouseName(name)) return back("house-name-invalid");

  const house = createHouse(name, person);
  if (!house) return back("house-name-taken");

  setLastHouse(person.id, house.id);
  logAction(person, "house_create", `house=${house.slug} name=${name}`);
  return redirect(`/h/${encodeURIComponent(house.slug)}`, 303);
};
