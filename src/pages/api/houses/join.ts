import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { broadcast } from "../../../lib/events";
import { addMember, houseByInviteCode, houseByName, isMember, setLastHouse } from "../../../lib/houses";
import { currentPerson } from "../../../lib/identity";
import { closeKnockOnJoin, doorKnock, knock } from "../../../lib/knocks";

export const prerender = false;

// Getting into a house, two ways that deliberately differ (PROCESS.md's
// "Knocking" section):
//  - by invite code (the /join/<code> link's "come in" button): straight in.
//    Someone inside chose to hand you the link.
//  - by typing its name (the street page's signpost, or the button on a
//    house's shut door): you KNOCK. You're stood at the door, not made a
//    member; any member can let you in or turn you away, and until then you
//    see nothing inside. Already a member? You just walk in.
// A POST, never a GET: like logout, a GET that changes who you are in the
// app could be fired by any <img> on any page.
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
  const inside = `/h/${encodeURIComponent(house.slug)}`;

  if (code) {
    if (addMember(house.id, person.id)) {
      logAction(person, "house_join", `house=${house.slug} via=invite`);
    }
    // Was already knocking there? The link made the knock moot: close it,
    // and clear it off every member's door.
    const closed = closeKnockOnJoin(house, person.id);
    if (closed !== null) {
      broadcast(house.id, {
        type: "knock_answered",
        data: { id: closed, name: person.name, outcome: "let_in", by: null },
      });
    }
    setLastHouse(person.id, house.id);
    return redirect(inside, 303);
  }

  if (isMember(house.id, person.id)) {
    setLastHouse(person.id, house.id);
    return redirect(inside, 303);
  }

  // Knocking twice is the same knock: only a new one is logged and rung.
  const { id, created } = knock(house.id, person.id);
  if (created) {
    logAction(person, "house_knock", `house=${house.slug} knocker=${person.name} knock=${id}`);
    const entry = doorKnock(id);
    if (entry) broadcast(house.id, { type: "knock", data: entry });
  }
  return redirect(`/houses?${new URLSearchParams({ knocked: house.slug })}`, 303);
};
