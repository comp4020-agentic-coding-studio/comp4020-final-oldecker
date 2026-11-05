// POST /api/push/subscribe, form body `endpoint`, `p256dh`, `auth` (the
// browser's PushSubscription, flattened): this device wants phone
// notifications for the logged-in person. Form-encoded like every mutation
// here, so Astro's same-origin check covers it. Subscribing the same device
// again is the same row (see saveSubscription in src/lib/push.ts).
//
//   200 {ok, created}   saved (created: false = this device was already on)
//   400                 not a push subscription
//   401                 logged out
import type { APIRoute } from "astro";
import { logAction } from "../../../lib/audit";
import { currentPerson } from "../../../lib/identity";
import { pushPublicKey, saveSubscription, validSubscription } from "../../../lib/push";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response("expected a form-encoded body", { status: 400 });

  const sub = {
    endpoint: String(form.get("endpoint") ?? ""),
    p256dh: String(form.get("p256dh") ?? ""),
    auth: String(form.get("auth") ?? ""),
  };
  if (!validSubscription(sub)) return new Response("not a push subscription", { status: 400 });

  // Stored even with push off, so the spec can check the route without
  // secrets; nothing is ever SENT without keys. The page never offers the
  // control in that case anyway.
  const { created } = saveSubscription(person.id, sub);
  if (created) logAction(person, "push_subscribe", `host=${new URL(sub.endpoint).host} enabled=${pushPublicKey() !== null}`);
  return json({ ok: true, created });
};
