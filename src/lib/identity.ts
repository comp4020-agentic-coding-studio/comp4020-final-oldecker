// Lightweight identity: no accounts, no passwords. Pick a name and a colour
// once, remembered via a cookie that maps to a `people` row server-side ---
// enough to genuinely distinguish between the ~15 people in the group,
// without building real auth for a closed, trusted link.
import { randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { people } from "./schema";

const COOKIE = "person_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

export const COLORS = [
  "#e07a5f", // terracotta
  "#81b29a", // sage
  "#f2cc8f", // sand
  "#3d5a80", // slate blue
  "#9d8189", // mauve
  "#e9c46a", // ochre
] as const;

export interface Person {
  id: string;
  name: string;
  color: string;
}

export function currentPerson(cookies: AstroCookies): Person | null {
  const id = cookies.get(COOKIE)?.value;
  if (!id) return null;
  const row = db.select().from(people).where(eq(people.id, id)).get();
  return row ?? null;
}

export function createPerson(cookies: AstroCookies, name: string, color: string): Person {
  const id = randomUUID();
  db.insert(people).values({ id, name, color }).run();
  cookies.set(COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: ONE_YEAR,
  });
  return { id, name, color };
}
