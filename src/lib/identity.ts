// Accounts and sessions. Identity is a name + password, proved once at
// /login or /signup, after which the browser holds an opaque session token.
//
// What's checked, and why it's built this way (full story in PROCESS.md):
//  - The cookie holds 32 random bytes, NOT a person id. Person ids are
//    visible in the page HTML (data-person-id on party-room avatars), so a
//    cookie that was just the id could be forged by copying one.
//  - The database stores only SHA-256(token). Reading the table (a backup,
//    a stray SELECT) doesn't hand anyone a working cookie. A plain fast hash
//    is right here, unlike for passwords: the token is 256 random bits, so
//    there's nothing to brute-force.
//  - The old `person_id` cookie is never read, so every pre-accounts cookie
//    stops authenticating the moment this ships.
//  - Rooms (a later phase) belong to people, not to sessions, so they need
//    no change here.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AstroCookies } from "astro";
import { eq, lt } from "drizzle-orm";
import { db } from "./db";
import { hashPassword } from "./password";
import { people, sessions } from "./schema";

const COOKIE = "session";
const LEGACY_COOKIE = "person_id";
const SESSION_SECONDS = 60 * 60 * 24 * 180; // 180 days: log in once per device, then forget about it

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 30;
export const MIN_PASSWORD_LENGTH = 8;
// An upper bound too, so a megabyte "password" can't be used to burn CPU in scrypt
export const MAX_PASSWORD_LENGTH = 200;

export interface Person {
  id: string;
  name: string;
  avatar: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// Collapse runs of whitespace so "Ole  D" and "Ole D" are the same name.
export function cleanName(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

// The case-insensitive identity of a name: what's unique, and what login
// looks accounts up by.
export function nameKeyOf(name: string): string {
  return cleanName(name).toLowerCase();
}

export function validateName(name: string): string | null {
  if (name.length < MIN_NAME_LENGTH) return `Pick a name at least ${MIN_NAME_LENGTH} characters long.`;
  if (name.length > MAX_NAME_LENGTH) return `Names can be at most ${MAX_NAME_LENGTH} characters.`;
  if (/\p{C}/u.test(name)) return "That name has characters we can't show.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Passwords can be at most ${MAX_PASSWORD_LENGTH} characters.`;
  return null;
}

export function currentPerson(cookies: AstroCookies): Person | null {
  const token = cookies.get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({
      id: people.id,
      name: people.name,
      avatar: people.avatar,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(people, eq(people.id, sessions.personId))
    .where(eq(sessions.id, hashToken(token)))
    .get();
  if (!row || row.expiresAt <= now()) return null;
  return { id: row.id, name: row.name, avatar: row.avatar };
}

export function nameTaken(name: string): boolean {
  return !!db.select({ id: people.id }).from(people).where(eq(people.nameKey, nameKeyOf(name))).get();
}

// Caller has validated name/password/avatar. Returns null when the name is
// taken (the unique index is the real guard; nameTaken() is only the friendly
// early check, and this catches the race between the two).
export async function createAccount(name: string, password: string, avatar: string): Promise<Person | null> {
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  try {
    db.insert(people).values({ id, name, avatar, passwordHash, nameKey: nameKeyOf(name) }).run();
  } catch (err) {
    if (err instanceof Error && "code" in err && String(err.code).startsWith("SQLITE_CONSTRAINT")) return null;
    throw err;
  }
  return { id, name, avatar };
}

export function startSession(cookies: AstroCookies, personId: string): void {
  const token = randomBytes(32).toString("base64url");
  const t = now();
  // expired sessions are swept as people log in --- no timer needed
  db.delete(sessions).where(lt(sessions.expiresAt, t)).run();
  db.insert(sessions)
    .values({ id: hashToken(token), personId, createdAt: t, expiresAt: t + SESSION_SECONDS })
    .run();
  cookies.set(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: SESSION_SECONDS,
  });
  // the pre-accounts cookie is dead weight now; tidy it from the browser
  if (cookies.has(LEGACY_COOKIE)) cookies.delete(LEGACY_COOKIE, { path: "/" });
}

export function endSession(cookies: AstroCookies): void {
  const token = cookies.get(COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
  cookies.delete(COOKIE, { path: "/" });
}
