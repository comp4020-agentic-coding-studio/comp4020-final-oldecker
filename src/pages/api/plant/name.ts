import type { APIRoute } from "astro";
import { broadcast } from "../../../lib/events";
import { currentPerson } from "../../../lib/identity";
import { MAX_NAME_LENGTH, setPlantName } from "../../../lib/plant";

export const prerender = false;

// Anyone in the group can rename the shared plant --- it's one communal
// thing, not owned by whoever watered it most. Form-encoded, same as every
// other mutation here, so it's covered by the same same-origin check.
export const POST: APIRoute = async ({ request, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, MAX_NAME_LENGTH);
  if (!name) return new Response("a plant needs a name", { status: 400 });

  setPlantName(name);
  broadcast({ type: "renamed", data: { name } });
  return new Response(JSON.stringify({ name }), { headers: { "content-type": "application/json" } });
};
