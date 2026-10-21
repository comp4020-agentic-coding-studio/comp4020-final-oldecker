import { eq } from "drizzle-orm";
import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { db } from "../../lib/db";
import { broadcast, updatePresenceAvatar } from "../../lib/events";
import { parseAvatar, serializeFace } from "../../lib/face";
import { currentPerson } from "../../lib/identity";
import { safeNext } from "../../lib/houses";
import { partyHousesOf, partyRoomSnapshot } from "../../lib/party";
import { people } from "../../lib/schema";

export const prerender = false;

// Form-encoded, not JSON: Astro's CSRF origin check only covers form-like
// (or bodyless) POSTs, so a JSON body would silently skip it --- same reason
// as score.ts. The updated row is always the caller's own (identity comes
// from the cookie, there's no id in the request to spoof), and the value is
// validated with parseAvatar() and re-serialised to its canonical form, so
// whatever lands in people.avatar is always exactly the known shape.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  // formData() throws on a non-form content type (e.g. someone POSTing JSON)
  const form = await request.formData().catch(() => null);
  if (!form) return new Response("expected a form-encoded body", { status: 400 });
  const face = parseAvatar(form.get("avatar"));
  if (!face) return new Response("invalid avatar", { status: 400 });
  const avatar = serializeFace(face);

  db.update(people).set({ avatar }).where(eq(people.id, person.id)).run();
  logAction(person, "avatar_update", `avatar=${avatar}`);

  // Show the new face live in every house that's watching: each corridor
  // you're standing in, and each party room you're in.
  updatePresenceAvatar(person.id, avatar);
  for (const houseId of partyHousesOf(person.id)) {
    const inRoom = partyRoomSnapshot(houseId).find((g) => g.personId === person.id);
    if (inRoom) broadcast(houseId, { type: "party_joined", data: { ...inRoom, avatar } });
  }

  // Back to the house you came from (the editor passes it along), else "/".
  return redirect(safeNext(String(form.get("next") ?? "")) ?? "/", 303);
};
