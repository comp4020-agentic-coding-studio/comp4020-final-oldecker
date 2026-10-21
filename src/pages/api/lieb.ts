// POST /api/lieb?house=<slug>, form body `to=<personId>`: send that member an
// "ich hab dich lieb". Form-encoded so Astro's same-origin check covers it,
// like every other mutation here. The sender's membership is checked by
// houseAccess; the recipient's, the no-self rule and the once-a-day limit
// by sendLieb (src/lib/lieb.ts).
//
//   200 {ok, toName, live}       sent (live: they had the house open)
//   400 {reason: "self"}         that's you
//   404 {reason: "not-member"}   no such member of this house
//   409 {reason: "already-today", toName}
import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { houseAccess } from "../../lib/houses";
import { sendLieb } from "../../lib/lieb";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const to = String(form?.get("to") ?? "");
  const result = sendLieb(house, person, to);
  if (!result.ok) return json({ ok: false, reason: result.reason, toName: result.toName }, result.status);

  logAction(person, "lieb_send", `house=${house.slug} to=${to.slice(0, 8)} live=${result.live}`);
  return json({ ok: true, toName: result.toName, live: result.live });
};
