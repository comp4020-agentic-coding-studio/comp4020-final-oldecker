// Each house's party room: anyone in the house can drag their own avatar in
// to signal "free to hang out" for a couple of hours. Membership lives in
// the party_guests table, not an in-memory Map --- see schema.ts's comment
// on why that matters specifically because this app's Fly machine scales to
// zero between visits. Every function takes the house: being in one house's
// party room says nothing about any other house's.
//
// Expiry is sweep-at-read (same "derive fresh, no cron" shape as
// sweepExpiredPosts in posts.ts) PLUS an active per-join setTimeout that
// broadcasts the moment someone's time is actually up, not just whenever
// someone next happens to load the page. The active half matters here in a
// way it doesn't for posts: the room is live (crit 9's own bar --- "a
// presence list that's stale... is just a guestbook"), so letting it look
// occupied to everyone already connected until the next reload would be a
// real regression, not just a cosmetic one. If the machine restarts, the
// in-flight timers are lost, but the next request's sweep and the next SSE
// connection's party_snapshot catch up --- the same self-healing-on-
// reconnect idiom this app already uses for presence.
//
// Like deletePostRecord in posts.ts, leaveParty() itself doesn't call
// logAction --- the caller does, since the caller has the context that
// decides *how* to log it: a route acting on a real person's own click logs
// under their name, while the sweep/timer (no person in scope) logs under
// `null`, the same split posts.ts's delete route vs. its sweep already use.
import { and, eq, lt, sql } from "drizzle-orm";
import { logAction } from "./audit";
import { db } from "./db";
import { broadcast } from "./events";
import { partyGuests, people } from "./schema";

const PARTY_DURATION_SECONDS = 60 * 60 * 2; // "a couple of hours"

// "houseId:personId" -> the timer scheduled for that guest's current
// expiry. Cleared and replaced on every join/re-join so a refreshed guest's
// old timer never fires early.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const timerKey = (houseId: number, personId: string) => `${houseId}:${personId}`;

export interface PartyGuest {
  personId: string;
  name: string;
  avatar: string;
  expiresAt: number;
}

export function joinParty(houseId: number, personId: string): { expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + PARTY_DURATION_SECONDS;
  db.insert(partyGuests)
    .values({ houseId, personId, expiresAt })
    .onConflictDoUpdate({
      target: [partyGuests.houseId, partyGuests.personId],
      set: { joinedAt: sql`(unixepoch())`, expiresAt },
    })
    .run();
  scheduleExpiry(houseId, personId, expiresAt);
  return { expiresAt };
}

function scheduleExpiry(houseId: number, personId: string, expiresAt: number): void {
  const key = timerKey(houseId, personId);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => expireIfDue(houseId, personId, expiresAt), Math.max(0, expiresAt * 1000 - Date.now())),
  );
}

const guestRow = (houseId: number, personId: string) =>
  and(eq(partyGuests.houseId, houseId), eq(partyGuests.personId, personId));

// Guards against a stale timer: if the row's expiresAt no longer matches
// what THIS timer was scheduled for, the guest refreshed or left since ---
// don't evict them on an old clock.
function expireIfDue(houseId: number, personId: string, expectedExpiresAt: number): void {
  const row = db.select({ expiresAt: partyGuests.expiresAt }).from(partyGuests).where(guestRow(houseId, personId)).get();
  if (!row || row.expiresAt !== expectedExpiresAt) return;
  if (leaveParty(houseId, personId)) logAction(null, "party_expire", `house=${houseId} personId=${personId}`);
}

// Returns whether a row actually existed to remove --- the caller (a route
// or the sweep) decides whether/how to log that, same split as
// deletePostRecord.
export function leaveParty(houseId: number, personId: string): boolean {
  const existed = db.delete(partyGuests).where(guestRow(houseId, personId)).returning().get();
  if (!existed) return false;

  const key = timerKey(houseId, personId);
  const timer = timers.get(key);
  if (timer) {
    clearTimeout(timer);
    timers.delete(key);
  }
  broadcast(houseId, { type: "party_left", data: { personId } });
  return true;
}

// Called once per request from the house page, same "derive at read time,
// no cron" shape as sweepExpiredPosts() --- catches anything a restart's
// lost timers missed. Sweeps every house, not just the one being viewed:
// it's one cheap indexed-by-nothing SELECT over a table of at most a few
// dozen rows, and it means a house nobody's opened lately can't keep a
// stale guest forever.
export function sweepExpiredPartyGuests(): void {
  const now = Math.floor(Date.now() / 1000);
  const expired = db
    .select({ houseId: partyGuests.houseId, personId: partyGuests.personId })
    .from(partyGuests)
    .where(lt(partyGuests.expiresAt, now))
    .all();
  for (const { houseId, personId } of expired) {
    if (leaveParty(houseId, personId)) logAction(null, "party_expire", `house=${houseId} personId=${personId}`);
  }
}

export function partyRoomSnapshot(houseId: number): PartyGuest[] {
  return db
    .select({ personId: partyGuests.personId, name: people.name, avatar: people.avatar, expiresAt: partyGuests.expiresAt })
    .from(partyGuests)
    .innerJoin(people, eq(partyGuests.personId, people.id))
    .where(eq(partyGuests.houseId, houseId))
    .all();
}

// Which houses this person is currently partying in --- used to refresh
// their face live in each of those rooms after an avatar edit.
export function partyHousesOf(personId: string): number[] {
  return db
    .select({ houseId: partyGuests.houseId })
    .from(partyGuests)
    .where(eq(partyGuests.personId, personId))
    .all()
    .map((r) => r.houseId);
}
