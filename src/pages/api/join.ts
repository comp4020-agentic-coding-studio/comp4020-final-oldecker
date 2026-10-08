import type { APIRoute } from "astro";
import { AVATAR_IDS } from "../../lib/avatars";
import { createPerson } from "../../lib/identity";

export const prerender = false;

// Presence itself is keyed off an open /api/events connection, not off
// joining --- a fresh join has no open stream yet, so there's nothing to
// broadcast here. The client connects to /api/events right after this
// redirect, and *that* connection is what announces presence.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const avatar = String(form.get("avatar") ?? "");

  if (!name) return new Response("name is required", { status: 400 });
  if (!AVATAR_IDS.includes(avatar)) return new Response("invalid avatar", { status: 400 });

  createPerson(cookies, name, avatar);
  return redirect("/", 303);
};
