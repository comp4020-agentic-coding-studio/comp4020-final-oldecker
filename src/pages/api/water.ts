import type { APIRoute } from "astro";
import { currentPerson } from "../../lib/identity";
import { plantHealth, recordWatering } from "../../lib/plant";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  recordWatering(person.id);
  return new Response(JSON.stringify(plantHealth()), {
    headers: { "content-type": "application/json" },
  });
};
