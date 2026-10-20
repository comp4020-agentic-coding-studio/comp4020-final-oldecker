// The shared party room: anyone can drag their own avatar in to signal
// "free to hang out" for a couple of hours. Membership lives in the
// party_guests table, not an in-memory Map --- see schema.ts's comment on
// why that matters specifically because this app's Fly machine scales to
// zero between visits.
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
import { eq, lt, sql } from "drizzle-orm";
import { logAction } from "./audit";
import { db } from "./db";
import { broadcast } from "./events";
import { partyGuests, people } from "./schema";

const PARTY_DURATION_SECONDS = 60 * 60 * 2; // "a couple of hours"

// personId -> the timer scheduled for that guest's current expiry. Cleared
// and replaced on every join/re-join so a refreshed guest's old timer never
// fires early.
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export interface PartyGuest {
  personId: string;
  name: string;
  avatar: string;
  expiresAt: number;
}

export function joinParty(personId: string): { expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + PARTY_DURATION_SECONDS;
  db.insert(partyGuests)
    .values({ personId, expiresAt })
    .onConflictDoUpdate({ target: partyGuests.personId, set: { joinedAt: sql`(unixepoch())`, expiresAt } })
    .run();
  scheduleExpiry(personId, expiresAt);
  return { expiresAt };
}

function scheduleExpiry(personId: string, expiresAt: number): void {
  const existing = timers.get(personId);
  if (existing) clearTimeout(existing);
  timers.set(
    personId,
    setTimeout(() => expireIfDue(personId, expiresAt), Math.max(0, expiresAt * 1000 - Date.now())),
  );
}

// Guards against a stale timer: if the row's expiresAt no longer matches
// what THIS timer was scheduled for, the guest refreshed or left since ---
// don't evict them on an old clock.
function expireIfDue(personId: string, expectedExpiresAt: number): void {
  const row = db.select({ expiresAt: partyGuests.expiresAt }).from(partyGuests).where(eq(partyGuests.personId, personId)).get();
  if (!row || row.expiresAt !== expectedExpiresAt) return;
  if (leaveParty(personId)) logAction(null, "party_expire", `personId=${personId}`);
}

// Returns whether a row actually existed to remove --- the caller (a route
// or the sweep) decides whether/how to log that, same split as
// deletePostRecord.
export function leaveParty(personId: string): boolean {
  const existed = db.delete(partyGuests).where(eq(partyGuests.personId, personId)).returning().get();
  if (!existed) return false;

  const timer = timers.get(personId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(personId);
  }
  broadcast({ type: "party_left", data: { personId } });
  return true;
}

// Called once per request from index.astro, same "derive at read time, no
// cron" shape as sweepExpiredPosts() --- catches anything a restart's lost
// timers missed.
export function sweepExpiredPartyGuests(): void {
  const now = Math.floor(Date.now() / 1000);
  const expired = db.select({ personId: partyGuests.personId }).from(partyGuests).where(lt(partyGuests.expiresAt, now)).all();
  for (const { personId } of expired) {
    if (leaveParty(personId)) logAction(null, "party_expire", `personId=${personId}`);
  }
}

export function partyRoomSnapshot(): PartyGuest[] {
  return db
    .select({ personId: partyGuests.personId, name: people.name, avatar: people.avatar, expiresAt: partyGuests.expiresAt })
    .from(partyGuests)
    .innerJoin(people, eq(partyGuests.personId, people.id))
    .all();
}
