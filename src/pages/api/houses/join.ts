import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { addMember, houseByInviteCode, houseByName, setLastHouse } from "../../../lib/houses";
import { currentPerson } from "../../../lib/identity";

export const prerender = false;

// Join a house, by invite code (the /join/<code> link's "come in" button)
// or by typing its name (the street page's signpost, or the "come in"
// button on a house's door). A POST, never a GET: like logout, a GET that
// changes who you are in the app could be fired by any <img> on any page,
// and joining is what puts a house on your street.
//
// Joining a house you're already in is fine and quiet: you just walk in,
// and nothing is logged (addMember reports whether it actually added).
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return new Response("expected a form-encoded body", { status: 400 });
  const code = String(form.get("code") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();

  const house = code ? houseByInviteCode(code) : name ? houseByName(name) : undefined;
  if (!house) {
    const q: Record<string, string> = code ? { error: "bad-invite" } : { error: "no-such-house", visit: name };
    return redirect(`/houses?${new URLSearchParams(q)}`, 303);
  }

  if (addMember(house.id, person.id)) {
    logAction(person, "house_join", `house=${house.slug} via=${code ? "invite" : "name"}`);
  }
  setLastHouse(person.id, house.id);
  return redirect(`/h/${encodeURIComponent(house.slug)}`, 303);
};
