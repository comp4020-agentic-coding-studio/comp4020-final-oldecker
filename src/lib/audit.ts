// "Who did what", durable and legible at a glance: every mutation in the app
// calls logAction once, which writes one audit_log row (see schema.ts) and
// prints exactly one console line built from that same row's own fields ---
// never a second, independently-worded message, so the two can't drift.
// Fly ships stdout straight to `flyctl logs`, so this needs no extra
// plumbing to be the thing a crit presenter reads live, by name, to narrate
// two people's actions apart.
//
// The line carries both the name AND a short id prefix. Name alone isn't
// enough to tell two people apart at a crit: nothing stops two pod members
// typing the same name at /api/join, and crit 10's whole test is exactly
// that --- can the log actually distinguish two browsers --- so a log line
// that falls back to matching display names on a collision would fail the
// one thing it exists to do. The id's first 8 characters (out of a full
// UUID) are enough to tell two rows apart at a glance without the full
// 36-character id drowning out the rest of the line.
import { eq } from "drizzle-orm";
import { activityLevel } from "./activity";
import { db } from "./db";
import { broadcast } from "./events";
import type { Person } from "./identity";
import { ACTION_WEIGHTS } from "./levels";
import { auditLog, houseMembers } from "./schema";

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function logAction(person: Person | null, action: string, detail: string): void {
  // Levels are derived from this very table, so this is the one place that
  // sees every point being earned. Only weighted actions can change a level;
  // everything else skips the extra two reads.
  const scores = person !== null && action in ACTION_WEIGHTS;
  const before = scores ? activityLevel(person.id) : null;
  db.insert(auditLog)
    .values({ personId: person?.id ?? null, action, detail })
    .run();
  const who = person ? `${person.name} (${shortId(person.id)})` : "system";
  console.log(`[audit] ${action} person=${who} detail=${detail}`);
  if (person && before) announceLevel(person.id, before.points);
}

// Levels are public within a house, so a change is pushed to every house the
// person belongs to (not just the one they acted in): their badge, ring and
// leaderboard row are on all of those pages. Most actions earn nothing (the
// same action twice in a UTC day is worth it once), and then nothing is sent.
function announceLevel(personId: string, pointsBefore: number): void {
  const after = activityLevel(personId);
  if (after.points === pointsBefore) return;
  const houseIds = db
    .select({ houseId: houseMembers.houseId })
    .from(houseMembers)
    .where(eq(houseMembers.personId, personId))
    .all();
  for (const { houseId } of houseIds)
    broadcast(houseId, { type: "level", data: { personId, level: after.level, points: after.points } });
}
