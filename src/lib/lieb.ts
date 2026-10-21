// "ich hab dich lieb": double-click someone's avatar and they get a heart.
// Private (only the recipient ever sees it), once per sender -> recipient per
// Canberra day, and never lost: if they have the house open it arrives live
// over their own SSE channel (events.ts's sendToPerson), otherwise it waits
// in lieb_messages until they next open the house. Full reasoning in
// PROCESS.md's "The bedroom, and ich hab dich lieb" section.
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { sendToPerson } from "./events";
import type { House } from "./houses";
import { isMember } from "./houses";
import type { Person } from "./identity";
import { liebMessages, people } from "./schema";
import { canberraDay } from "./week";

export type SendResult =
  | { ok: true; id: number; toName: string; live: boolean }
  | { ok: false; status: 400 | 404 | 409; reason: "self" | "not-member" | "already-today"; toName?: string };

function isConstraintError(err: unknown): boolean {
  return err instanceof Error && "code" in err && String(err.code).startsWith("SQLITE_CONSTRAINT");
}

// The caller has already checked the SENDER is a member of `house`
// (houseAccess); this checks the recipient is too.
export function sendLieb(house: House, from: Person, toPersonId: string): SendResult {
  if (toPersonId === from.id) return { ok: false, status: 400, reason: "self" };
  // Membership first, and the same answer whether the id is unknown or just
  // not in this house --- a non-member's name isn't this house's business.
  if (!toPersonId || !isMember(house.id, toPersonId)) return { ok: false, status: 404, reason: "not-member" };
  const to = db.select({ name: people.name }).from(people).where(eq(people.id, toPersonId)).get();
  if (!to) return { ok: false, status: 404, reason: "not-member" };

  let row: { id: number; createdAt: number } | undefined;
  try {
    // The unique (from, to, day) index is the limit itself. Insert-and-catch
    // rather than check-then-insert, so two quick double-clicks (or two
    // tabs) can't both pass a "not yet today?" check before either writes.
    row = db
      .insert(liebMessages)
      .values({ houseId: house.id, fromPersonId: from.id, toPersonId, day: canberraDay() })
      .returning({ id: liebMessages.id, createdAt: liebMessages.createdAt })
      .get();
  } catch (err) {
    if (isConstraintError(err)) return { ok: false, status: 409, reason: "already-today", toName: to.name };
    throw err;
  }

  // Delivered to the recipient's own streams in this house and nobody
  // else's. Not marked seen here: an open-but-hidden tab "receives" it too,
  // so the recipient's page confirms once it has actually shown it
  // (markLiebSeen, via /api/lieb/seen). Until then it's still in their inbox.
  const live = sendToPerson(house.id, toPersonId, {
    type: "lieb",
    data: { id: row.id, fromPersonId: from.id, fromName: from.name, createdAt: row.createdAt },
  });
  return { ok: true, id: row.id, toName: to.name, live };
}

export interface InboxItem {
  id: number;
  fromPersonId: string;
  fromName: string;
  createdAt: number;
}

// Every heart sent to this person in this house that they haven't been shown
// yet, oldest first --- and marks them shown, because the page that calls
// this is the one about to show them. A heart sent in another house waits
// for that house: it belongs to where it was sent.
export function takeUnseenLieb(houseId: number, personId: string): InboxItem[] {
  const unseen = and(
    eq(liebMessages.houseId, houseId),
    eq(liebMessages.toPersonId, personId),
    isNull(liebMessages.seenAt),
  );
  return db.transaction((tx) => {
    const items = tx
      .select({
        id: liebMessages.id,
        fromPersonId: liebMessages.fromPersonId,
        fromName: people.name,
        createdAt: liebMessages.createdAt,
      })
      .from(liebMessages)
      .innerJoin(people, eq(people.id, liebMessages.fromPersonId))
      .where(unseen)
      .orderBy(asc(liebMessages.createdAt), asc(liebMessages.id))
      .all();
    if (items.length > 0) {
      tx.update(liebMessages)
        .set({ seenAt: Math.floor(Date.now() / 1000) })
        .where(unseen)
        .run();
    }
    return items;
  });
}

// The recipient's page confirming it showed a live heart. Only ever touches
// a row addressed to this person, in this house --- an id belonging to
// someone else is silently a no-op.
export function markLiebSeen(houseId: number, personId: string, id: number): boolean {
  const res = db
    .update(liebMessages)
    .set({ seenAt: Math.floor(Date.now() / 1000) })
    .where(
      and(
        eq(liebMessages.id, id),
        eq(liebMessages.houseId, houseId),
        eq(liebMessages.toPersonId, personId),
        isNull(liebMessages.seenAt),
      ),
    )
    .run();
  return res.changes > 0;
}
