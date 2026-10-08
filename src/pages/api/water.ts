import type { APIRoute } from "astro";
import { broadcast } from "../../lib/events";
import { currentPerson } from "../../lib/identity";
import { plantHealth, recordWatering } from "../../lib/plant";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  recordWatering(person.id);
  const health = plantHealth();
  // Live for everyone watching, not just whoever clicked --- the plant is
  // one of this week's two things that update without a reload.
  broadcast({ type: "watered", data: health });
  return new Response(JSON.stringify(health), {
    headers: { "content-type": "application/json" },
  });
};
