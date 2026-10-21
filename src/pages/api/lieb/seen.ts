// POST /api/lieb/seen?house=<slug>, form body `id=<n>`: the recipient's page
// saying "I've shown this live heart", so it doesn't come round again on
// their next visit. Only ever marks a heart addressed to the caller, in this
// house; anything else is a quiet no-op.
import type { APIRoute } from "astro";
import { houseAccess } from "../../../lib/houses";
import { markLiebSeen } from "../../../lib/lieb";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const id = Number(form?.get("id"));
  if (!Number.isInteger(id) || id <= 0) return new Response("which one? (pass id=<n>)", { status: 400 });
  markLiebSeen(access.house.id, access.person.id, id);
  return new Response(null, { status: 204 });
};
