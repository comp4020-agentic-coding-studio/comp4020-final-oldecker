// Knocking: how "visit by name" gets you into a house now. Typing a house's
// name no longer makes you a member --- it stands you at its front door, and
// any member can let you in or turn you away. An invite link still walks
// you straight in (someone inside chose to hand it to you). Full reasoning
// in PROCESS.md's "Knocking" section.
//
// The rules this file enforces, all on the server:
//  - only a current member of a house can answer its knocks;
//  - only the knocker can take back (cancel) their own knock;
//  - answering a knock that's already been answered changes nothing --- the
//    UPDATE is conditional on outcome = 'pending', so two members pressing
//    "let in" and "turn away" at the same moment can't both win;
//  - letting someone in is what makes them a member, in the same
//    transaction as closing the knock.
// A knock never expires on its own: it waits until someone answers.
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "./db";
import { addMember, isMember, type House } from "./houses";
import { houseKnocks, houses, people } from "./schema";

export type KnockOutcome = "pending" | "let_in" | "turned_away" | "cancelled";

// What a member sees at their front door: who's knocking, with the face
// they'll recognise.
export interface DoorKnock {
  id: number;
  personId: string;
  name: string;
  avatar: string;
  createdAt: number;
}

// What a knocker sees on their street: which door they're at, or what
// came of a knock they haven't been told about yet.
export interface MyKnock {
  id: number;
  outcome: KnockOutcome;
  houseId: number;
  houseSlug: string;
  houseName: string;
  createdAt: number;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function pendingKnockOf(houseId: number, personId: string): { id: number } | undefined {
  return db
    .select({ id: houseKnocks.id })
    .from(houseKnocks)
    .where(
      and(eq(houseKnocks.houseId, houseId), eq(houseKnocks.personId, personId), eq(houseKnocks.outcome, "pending")),
    )
    .get();
}

// Knock on a house's door. Knocking while already waiting there is the
// same knock, not a second one (the partial unique index is the real
// guard; this just reports which happened, so the caller logs and
// broadcasts only a NEW knock). Caller has checked they aren't a member.
export function knock(houseId: number, personId: string): { id: number; created: boolean } {
  const row = db
    .insert(houseKnocks)
    .values({ houseId, personId })
    .onConflictDoNothing()
    .returning({ id: houseKnocks.id })
    .get();
  if (row) return { id: row.id, created: true };
  const existing = pendingKnockOf(houseId, personId);
  if (!existing) throw new Error("knock: insert conflicted but no pending knock found");
  return { id: existing.id, created: false };
}

// Everyone waiting at this house's door, longest-waiting first.
export function pendingKnocks(houseId: number): DoorKnock[] {
  return db
    .select({
      id: houseKnocks.id,
      personId: houseKnocks.personId,
      name: people.name,
      avatar: people.avatar,
      createdAt: houseKnocks.createdAt,
    })
    .from(houseKnocks)
    .innerJoin(people, eq(people.id, houseKnocks.personId))
    .where(and(eq(houseKnocks.houseId, houseId), eq(houseKnocks.outcome, "pending")))
    .orderBy(asc(houseKnocks.createdAt), asc(houseKnocks.id))
    .all();
}

export function doorKnock(knockId: number): DoorKnock | undefined {
  return db
    .select({
      id: houseKnocks.id,
      personId: houseKnocks.personId,
      name: people.name,
      avatar: people.avatar,
      createdAt: houseKnocks.createdAt,
    })
    .from(houseKnocks)
    .innerJoin(people, eq(people.id, houseKnocks.personId))
    .where(eq(houseKnocks.id, knockId))
    .get();
}

// The street page's view of your knocks: every door you're waiting at, plus
// any answered knock you haven't been shown yet (seenAt null). Cancelled
// knocks are your own doing, so there's nothing to tell you about them.
export function myKnocks(personId: string): MyKnock[] {
  return db
    .select({
      id: houseKnocks.id,
      outcome: houseKnocks.outcome,
      houseId: houseKnocks.houseId,
      houseSlug: houses.slug,
      houseName: houses.name,
      createdAt: houseKnocks.createdAt,
    })
    .from(houseKnocks)
    .innerJoin(houses, eq(houses.id, houseKnocks.houseId))
    .where(and(eq(houseKnocks.personId, personId), isNull(houseKnocks.seenAt), ne(houseKnocks.outcome, "cancelled")))
    .orderBy(desc(houseKnocks.createdAt), desc(houseKnocks.id))
    .all() as MyKnock[];
}

// "You were let in / turned away" is said once: the street page calls this
// for the answered knocks it just rendered.
export function markKnocksSeen(personId: string, knockIds: number[]): void {
  for (const id of knockIds) {
    db.update(houseKnocks)
      .set({ seenAt: nowSeconds() })
      .where(and(eq(houseKnocks.id, id), eq(houseKnocks.personId, personId), ne(houseKnocks.outcome, "pending")))
      .run();
  }
}

export interface KnockRow {
  id: number;
  houseId: number;
  personId: string;
  outcome: KnockOutcome;
}

export function knockById(knockId: number): KnockRow | undefined {
  if (!Number.isSafeInteger(knockId) || knockId <= 0) return undefined;
  return db
    .select({
      id: houseKnocks.id,
      houseId: houseKnocks.houseId,
      personId: houseKnocks.personId,
      outcome: houseKnocks.outcome,
    })
    .from(houseKnocks)
    .where(eq(houseKnocks.id, knockId))
    .get() as KnockRow | undefined;
}

// Close a pending knock with an answer. Returns true only if THIS call
// closed it --- false means someone else already answered (or the knocker
// walked away), and the caller does nothing further: no log line, no
// broadcast, no membership. Letting in adds the membership inside the same
// transaction, so there's never a "let_in" knock without a member row.
//
// The caller has already checked who's allowed to do this (a member of
// the house for let_in/turned_away, the knocker for cancelled); this
// re-checks the house membership of the answerer anyway, so the rule
// can't be lost by a future route forgetting it.
export function answerKnock(
  knock: KnockRow,
  outcome: Exclude<KnockOutcome, "pending">,
  answeredBy: string | null,
): boolean {
  if (outcome !== "cancelled" && (!answeredBy || !isMember(knock.houseId, answeredBy))) return false;
  if (outcome === "cancelled" && answeredBy !== knock.personId) return false;
  return db.transaction((tx) => {
    const closed = tx
      .update(houseKnocks)
      .set({
        outcome,
        answeredAt: nowSeconds(),
        answeredBy,
        // nothing to tell the knocker about their own cancel
        seenAt: outcome === "cancelled" ? nowSeconds() : null,
      })
      .where(and(eq(houseKnocks.id, knock.id), eq(houseKnocks.outcome, "pending")))
      .returning({ id: houseKnocks.id })
      .get();
    if (!closed) return false;
    if (outcome === "let_in") addMember(knock.houseId, knock.personId);
    return true;
  });
}

// Someone waiting at the door came in another way (an invite link): their
// knock is moot. Closed as let_in with no answerer, already seen --- they
// walked in themselves, so there's no "you were let in" to tell them.
export function closeKnockOnJoin(house: House, personId: string): number | null {
  const row = db
    .update(houseKnocks)
    .set({ outcome: "let_in", answeredAt: nowSeconds(), seenAt: nowSeconds() })
    .where(
      and(eq(houseKnocks.houseId, house.id), eq(houseKnocks.personId, personId), eq(houseKnocks.outcome, "pending")),
    )
    .returning({ id: houseKnocks.id })
    .get();
  return row?.id ?? null;
}
