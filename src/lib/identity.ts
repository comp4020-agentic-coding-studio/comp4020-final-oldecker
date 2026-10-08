// Lightweight identity: no accounts, no passwords. Pick a name and an
// avatar once, remembered via a cookie that maps to a `people` row
// server-side --- enough to genuinely distinguish between the ~15 people in
// the group, without building real auth for a closed, trusted link.
import { randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { people } from "./schema";

const COOKIE = "person_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface Person {
  id: string;
  name: string;
  avatar: string;
}

export function currentPerson(cookies: AstroCookies): Person | null {
  const id = cookies.get(COOKIE)?.value;
  if (!id) return null;
  const row = db.select().from(people).where(eq(people.id, id)).get();
  return row ?? null;
}

export function createPerson(cookies: AstroCookies, name: string, avatar: string): Person {
  const id = randomUUID();
  db.insert(people).values({ id, name, avatar }).run();
  cookies.set(COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: ONE_YEAR,
  });
  return { id, name, avatar };
}
