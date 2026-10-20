import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { broadcast } from "../../../lib/events";
import { currentPerson } from "../../../lib/identity";
import { joinParty } from "../../../lib/party";

export const prerender = false;

// Bodyless POST, same as water.ts --- no params to pass (identity comes
// from the cookie), which also means no content-type header, which routes
// into Astro's origin-check middleware's unconditional same-origin branch.
// The access check here is actually simpler than post-delete's: there's no
// id in the request to compare ownership against at all --- the row acted
// on is always the caller's own, nothing to spoof. Re-joining while already
// in the room is a plain upsert in joinParty(), so this route doesn't need
// to distinguish "join" from "refresh" --- see PROCESS.md's crit-10 ADR.
export const POST: APIRoute = async ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const { expiresAt } = joinParty(person.id);
  logAction(person, "party_join", `expiresAt=${expiresAt}`);
  broadcast({
    type: "party_joined",
    data: { personId: person.id, name: person.name, avatar: person.avatar, expiresAt },
  });
  return new Response(JSON.stringify({ expiresAt }), { headers: { "content-type": "application/json" } });
};
