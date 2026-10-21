import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { broadcast } from "../../lib/events";
import { houseAccess } from "../../lib/houses";
import { plantHealth, recordWatering } from "../../lib/plant";

export const prerender = false;

// Bodyless POST to /api/water?house=<slug>: the house rides in the URL so
// the request stays bodyless (and so inside Astro's unconditional
// same-origin check). houseAccess() is the membership gate --- see
// src/lib/houses.ts.
export const POST: APIRoute = async ({ cookies, url }) => {
  const access = houseAccess(cookies, url);
  if (access instanceof Response) return access;
  const { person, house } = access;

  recordWatering(house.id, person.id);
  const health = plantHealth(house.id);
  logAction(person, "water", `house=${house.slug} waterersThisWeek=${health.waterersThisWeek}`);
  // Live for everyone in this house, not just whoever clicked --- the plant
  // is one of the things that update without a reload.
  broadcast(house.id, { type: "watered", data: health });
  return new Response(JSON.stringify(health), {
    headers: { "content-type": "application/json" },
  });
};
