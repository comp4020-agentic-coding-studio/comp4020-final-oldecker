import type { APIRoute } from "astro";
import { houseAccess } from "../../../lib/houses";
import { castWallVote } from "../../../lib/wallvote";

export const prerender = false;

// POST /api/wall/vote?house=<slug>, form body `choice=yes|no`. Casts (or
// changes) your own ballot in the house's wipe-the-wall vote, starting one if
// none is open --- see src/lib/wallvote.ts for the pass rules. Form-encoded,
// same as every mutation here, so it's covered by Astro's same-origin check.
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const choice = form?.get("choice");
  if (choice !== "yes" && choice !== "no") return new Response("choice must be yes or no", { status: 400 });

  const state = castWallVote(house, person, choice);
  return new Response(JSON.stringify(state), { headers: { "content-type": "application/json" } });
};
