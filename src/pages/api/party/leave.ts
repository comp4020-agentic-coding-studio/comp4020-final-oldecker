import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { currentPerson } from "../../../lib/identity";
import { leaveParty } from "../../../lib/party";

export const prerender = false;

// Bodyless POST, same shape as join.ts --- dragging your own avatar back
// out of the room is a distinct gesture from dragging it in, so the client
// already knows the intent; this route only ever acts on the caller's own
// row (leaveParty(person.id)), never anyone else's.
export const POST: APIRoute = async ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  if (leaveParty(person.id)) logAction(person, "party_leave", "manual");
  return new Response(null, { status: 204 });
};
