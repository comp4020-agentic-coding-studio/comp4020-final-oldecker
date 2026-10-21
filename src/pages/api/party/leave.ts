import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { houseAccess } from "../../../lib/houses";
import { leaveParty } from "../../../lib/party";

export const prerender = false;

// Bodyless POST, same shape as join.ts --- dragging your own avatar back
// out of the room is a distinct gesture from dragging it in, so the client
// already knows the intent; this route only ever acts on the caller's own
// row in the named house (leaveParty(house.id, person.id)), never anyone
// else's.
export const POST: APIRoute = async ({ cookies, url }) => {
  const access = houseAccess(cookies, url);
  if (access instanceof Response) return access;
  const { person, house } = access;

  if (leaveParty(house.id, person.id)) logAction(person, "party_leave", `house=${house.slug} manual`);
  return new Response(null, { status: 204 });
};
