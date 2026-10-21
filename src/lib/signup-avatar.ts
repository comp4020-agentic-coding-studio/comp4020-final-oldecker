// Server-side half of the signup avatar field (the client half is
// src/components/AvatarEditor.astro). Returns the value to store in
// people.avatar, or null if the submitted value isn't acceptable.
//
// A face config is stored in canonical form; a missing field gets a random
// face (editable later at /avatar). The six legacy creature ids are still
// accepted so spec/auth-helpers.ts can sign up with `avatar=bunyip` --- they
// render through face.ts's legacy fallback. Anything else is rejected.
import { isLegacyAvatarId, parseAvatar, randomFace, serializeFace } from "./face";

export function parseSignupAvatar(form: FormData): string | null {
  const raw = form.get("avatar");
  if (raw === null || raw === "") return serializeFace(randomFace());
  const face = parseAvatar(raw);
  if (face) return serializeFace(face);
  if (typeof raw === "string" && isLegacyAvatarId(raw)) return raw;
  return null;
}
