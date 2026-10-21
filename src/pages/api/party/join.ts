import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { broadcast } from "../../../lib/events";
import { houseAccess } from "../../../lib/houses";
import { joinParty } from "../../../lib/party";

export const prerender = false;

// Bodyless POST to /api/party/join?house=<slug> --- no params beyond which
// house (identity comes from the cookie), which also means no content-type
// header, which routes into Astro's origin-check middleware's unconditional
// same-origin branch. Two checks, both on the server: you're a member of
// the house (houseAccess), and the row acted on is always the caller's own
// --- there's no person id in the request to spoof. Re-joining while
// already in the room is a plain upsert in joinParty(), so this route
// doesn't need to distinguish "join" from "refresh" --- see PROCESS.md's
// crit-10 ADR.
export const POST: APIRoute = async ({ cookies, url }) => {
  const access = houseAccess(cookies, url);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const { expiresAt } = joinParty(house.id, person.id);
  logAction(person, "party_join", `house=${house.slug} expiresAt=${expiresAt}`);
  broadcast(house.id, {
    type: "party_joined",
    data: { personId: person.id, name: person.name, avatar: person.avatar, expiresAt },
  });
  return new Response(JSON.stringify({ expiresAt }), { headers: { "content-type": "application/json" } });
};
