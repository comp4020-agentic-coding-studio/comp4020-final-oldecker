// POST /api/push/unsubscribe, form body `endpoint`: this device stops
// getting notifications. Only ever removes a row belonging to the logged-in
// person --- someone else's endpoint is a quiet no-op (removed: false).
//
//   200 {ok, removed}
//   400                 no endpoint
//   401                 logged out
import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { currentPerson } from "../../../lib/identity";
import { removeSubscription } from "../../../lib/push";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });
  const form = await request.formData().catch(() => null);
  const endpoint = String(form?.get("endpoint") ?? "");
  if (!endpoint) return new Response("expected an endpoint", { status: 400 });

  const removed = removeSubscription(person.id, endpoint);
  if (removed) logAction(person, "push_unsubscribe", `host=${URL.canParse(endpoint) ? new URL(endpoint).host : "?"}`);
  return new Response(JSON.stringify({ ok: true, removed }), { headers: { "content-type": "application/json" } });
};
