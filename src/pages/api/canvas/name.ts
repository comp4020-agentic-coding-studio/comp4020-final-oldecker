import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { MAX_CANVAS_NAME_LENGTH, setCanvasName } from "../../../lib/canvas-meta";
import { broadcast } from "../../../lib/events";
import { houseAccess } from "../../../lib/houses";

export const prerender = false;

// Anyone in the house can rename its wall --- same "one communal thing, not
// owned by whoever's painted most" reasoning as the plant's own rename
// (src/pages/api/plant/name.ts). Form-encoded, same as every other mutation
// here, so it's covered by the same same-origin check.
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const name = String(form?.get("name") ?? "").trim().slice(0, MAX_CANVAS_NAME_LENGTH);
  if (!name) return new Response("the wall needs a name", { status: 400 });

  setCanvasName(house.id, name);
  logAction(person, "canvas_rename", `house=${house.slug} name=${name}`);
  broadcast(house.id, { type: "canvas_renamed", data: { name } });
  return new Response(JSON.stringify({ name }), { headers: { "content-type": "application/json" } });
};
