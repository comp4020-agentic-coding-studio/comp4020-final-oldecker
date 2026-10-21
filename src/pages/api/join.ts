import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { isLegacyAvatarId, parseAvatar, randomFace, serializeFace } from "../../lib/face";
import { createPerson } from "../../lib/identity";

export const prerender = false;

// Presence itself is keyed off an open /api/events connection, not off
// joining --- a fresh join has no open stream yet, so there's nothing to
// broadcast here. The client connects to /api/events right after this
// redirect, and *that* connection is what announces presence.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  if (!name) return new Response("name is required", { status: 400 });

  // A valid face config is stored in canonical form. A missing avatar gets a
  // random face (editable later at /avatar). The six old creature ids are
  // still accepted here so existing callers/spec tests that join with
  // avatar=bunyip keep working --- they render via face.ts's legacy fallback.
  // Anything else is rejected.
  const raw = form.get("avatar");
  let avatar: string;
  if (raw === null || raw === "") avatar = serializeFace(randomFace());
  else {
    const face = parseAvatar(raw);
    if (face) avatar = serializeFace(face);
    else if (typeof raw === "string" && isLegacyAvatarId(raw)) avatar = raw;
    else return new Response("invalid avatar", { status: 400 });
  }

  const person = createPerson(cookies, name, avatar);
  logAction(person, "person_join", `name=${name} avatar=${avatar}`);
  return redirect("/", 303);
};
