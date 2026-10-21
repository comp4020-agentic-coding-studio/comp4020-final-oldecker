// Server-side half of the signup avatar field (the client half is
// src/components/AvatarPicker.astro). Returns the value to store in
// people.avatar, or null if the submitted value isn't acceptable. When the
// face builder replaces the picker, this is the one function to change.
import { AVATAR_IDS } from "./avatars";

export function parseSignupAvatar(form: FormData): string | null {
  const avatar = String(form.get("avatar") ?? "");
  return AVATAR_IDS.includes(avatar) ? avatar : null;
}
