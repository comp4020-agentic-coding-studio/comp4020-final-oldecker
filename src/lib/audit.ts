// "Who did what", durable and legible at a glance: every mutation in the app
// calls logAction once, which writes one audit_log row (see schema.ts) and
// prints exactly one console line built from that same row's own fields ---
// never a second, independently-worded message, so the two can't drift.
// Fly ships stdout straight to `flyctl logs`, so this needs no extra
// plumbing to be the thing a crit presenter reads live, by name (not just an
// opaque id), to narrate two people's actions apart.
import { db } from "./db";
import type { Person } from "./identity";
import { auditLog } from "./schema";

export function logAction(person: Person | null, action: string, detail: string): void {
  db.insert(auditLog)
    .values({ personId: person?.id ?? null, action, detail })
    .run();
  console.log(`[audit] ${action} person=${person?.name ?? "system"} detail=${detail}`);
}
