// Houses: independent copies of the board (feed, plant, wall, party room),
// each with its own members. Accounts are global; a person can belong to any
// number of houses. Full reasoning in PROCESS.md's "Houses" section.
//
// The access-control rule this file exists to enforce: nothing about a house
// --- not a post, not a pixel, not who's in its corridor --- is read or
// changed by anyone who isn't a member of it. Every house page and every API
// route goes through houseAccess() or isMember() before touching house data,
// and the house is always named explicitly in the request (a URL segment or
// a `house` parameter), never inferred from "the last house you opened" ---
// so a stale tab can't silently write into the wrong house.
import { randomBytes } from "node:crypto";
import type { AstroCookies } from "astro";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { currentPerson, type Person } from "./identity";
import { houseMembers, houses, people } from "./schema";

export const MIN_HOUSE_NAME_LENGTH = 2;
export const MAX_HOUSE_NAME_LENGTH = 30;

export interface House {
  id: number;
  slug: string;
  name: string;
  inviteCode: string;
}

const houseColumns = { id: houses.id, slug: houses.slug, name: houses.name, inviteCode: houses.inviteCode };

export function cleanHouseName(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

// The URL-safe, case-insensitive identity of a house name. "The Board",
// "the board!" and "the  board" all slug to "the-board", so they're one
// house, not three look-alikes --- and "visit by name" can be typed any of
// those ways. Letters in any script are kept (encodeURIComponent handles
// them in links); everything else becomes a single dash.
export function slugify(name: string): string {
  return cleanHouseName(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function validateHouseName(name: string): string | null {
  if (name.length < MIN_HOUSE_NAME_LENGTH || name.length > MAX_HOUSE_NAME_LENGTH)
    return `House names need ${MIN_HOUSE_NAME_LENGTH} to ${MAX_HOUSE_NAME_LENGTH} characters.`;
  if (/\p{C}/u.test(name)) return "That name has characters we can't show.";
  if (!slugify(name)) return "A house name needs at least one letter or number.";
  return null;
}

function newInviteCode(): string {
  // 72 random bits, URL-safe: unguessable, and still short enough to paste
  return randomBytes(9).toString("base64url");
}

function isConstraintError(err: unknown): boolean {
  return err instanceof Error && "code" in err && String(err.code).startsWith("SQLITE_CONSTRAINT");
}

// Caller has validated the name. Returns null when its slug is taken (the
// unique index is the real guard, same pattern as createAccount).
export function createHouse(name: string, person: Person): House | null {
  const slug = slugify(name);
  try {
    return db.transaction((tx) => {
      const house = tx
        .insert(houses)
        .values({ slug, name, inviteCode: newInviteCode(), createdBy: person.id })
        .returning(houseColumns)
        .get();
      tx.insert(houseMembers).values({ houseId: house.id, personId: person.id }).run();
      return house;
    });
  } catch (err) {
    if (isConstraintError(err)) return null;
    throw err;
  }
}

export function houseBySlug(slug: string): House | undefined {
  return db.select(houseColumns).from(houses).where(eq(houses.slug, slug)).get();
}

export function houseByName(name: string): House | undefined {
  const slug = slugify(name);
  return slug ? houseBySlug(slug) : undefined;
}

export function houseByInviteCode(code: string): House | undefined {
  if (!code) return undefined;
  return db.select(houseColumns).from(houses).where(eq(houses.inviteCode, code)).get();
}

export function isMember(houseId: number, personId: string): boolean {
  return !!db
    .select({ houseId: houseMembers.houseId })
    .from(houseMembers)
    .where(and(eq(houseMembers.houseId, houseId), eq(houseMembers.personId, personId)))
    .get();
}

// Returns true only when this actually added a membership, so the caller
// logs house_join once, not on every repeat visit of the same link.
export function addMember(houseId: number, personId: string): boolean {
  const row = db.insert(houseMembers).values({ houseId, personId }).onConflictDoNothing().returning().get();
  return !!row;
}

// Every house this person belongs to, oldest membership first --- the order
// the street page lines them up in, so a new house appears at the end of
// the row rather than shuffling the ones you already know.
export function housesOf(personId: string): House[] {
  return db
    .select(houseColumns)
    .from(houseMembers)
    .innerJoin(houses, eq(houses.id, houseMembers.houseId))
    .where(eq(houseMembers.personId, personId))
    .orderBy(asc(houseMembers.joinedAt), asc(houses.id))
    .all();
}

export function setLastHouse(personId: string, houseId: number): void {
  db.update(people).set({ lastHouseId: houseId }).where(eq(people.id, personId)).run();
}

// Where "/" sends a logged-in person: the house they last opened, if they're
// still a member of it; otherwise none (the street page). Re-checks
// membership rather than trusting the stored id.
export function lastHouseFor(personId: string): House | undefined {
  const row = db.select({ lastHouseId: people.lastHouseId }).from(people).where(eq(people.id, personId)).get();
  if (!row?.lastHouseId || !isMember(row.lastHouseId, personId)) return undefined;
  return db.select(houseColumns).from(houses).where(eq(houses.id, row.lastHouseId)).get();
}

// How many people belong to each of these houses (for the street page's
// little "3 live here" labels).
export function memberCounts(houseIds: number[]): Map<number, number> {
  if (houseIds.length === 0) return new Map();
  const rows = db
    .select({ houseId: houseMembers.houseId, n: sql<number>`count(*)` })
    .from(houseMembers)
    .where(inArray(houseMembers.houseId, houseIds))
    .groupBy(houseMembers.houseId)
    .all();
  return new Map(rows.map((r) => [r.houseId, r.n]));
}

// The one gate every house-scoped API route goes through: who's asking,
// which house they named, and whether they're in it. The house comes from
// the URL's ?house= first, else a `house` form field, so both bodyless
// POSTs (which keep Astro's origin check unconditional) and form posts can
// name it. A Response means "stop here and send this":
//   401 not logged in, 400 no house named, 404 no such house, 403 not a member.
export function houseAccess(
  cookies: AstroCookies,
  url: URL,
  form?: FormData | null,
): { person: Person; house: House } | Response {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });
  const slug = url.searchParams.get("house") ?? (form ? String(form.get("house") ?? "") : "");
  if (!slug) return new Response("which house? (pass ?house=<slug>)", { status: 400 });
  const house = houseBySlug(slug);
  if (!house) return new Response("no such house", { status: 404 });
  if (!isMember(house.id, person.id)) return new Response("you're not a member of this house", { status: 403 });
  return { person, house };
}

// A local path to come back to after logging in --- only ever one of this
// app's own house or invite pages, so a crafted ?next= can't bounce someone
// off to another site.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return /^\/(h|join)\/[^/\\][^\\]*$/.test(raw) && !raw.startsWith("//") ? raw : null;
}
