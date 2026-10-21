// A person's private "activity level": derived at read time from audit_log
// (same no-cron, no-stored-counter pattern as plantHealth() in plant.ts) and
// used only to shorten their own pixel cooldown. Never rendered to anyone
// but the person themselves --- see PROCESS.md's "Activity level" section.
//
// Points: each distinct (action type, UTC day) in the last 7 days earns that
// action's weight once. So ten ratings in one afternoon score the same as
// one, and no single action can be spammed past 7 x its weight.
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { auditLog } from "./schema";

export const ACTIVITY_WINDOW_SECONDS = 7 * 24 * 60 * 60;

// Pixel placing is worth little on purpose: alone it tops out at 7 points,
// short of level 3, so the wall can't be levelled up by painting the wall.
export const ACTION_WEIGHTS: Readonly<Record<string, number>> = {
  post_create: 4,
  water: 3,
  post_score: 2,
  party_join: 2,
  pixel_place: 1,
};

// [minimum points, cooldown seconds]; index + 1 is the level.
export const LEVELS: ReadonlyArray<readonly [number, number]> = [
  [0, 30],
  [4, 24],
  [10, 18],
  [18, 14],
  [28, 10],
];

export type ActivityLevel = { level: number; points: number; cooldownSeconds: number };

export function levelForPoints(points: number): ActivityLevel {
  let idx = 0;
  for (const [i, [min]] of LEVELS.entries()) if (points >= min) idx = i;
  return { level: idx + 1, points, cooldownSeconds: LEVELS[idx][1] };
}

export function activityLevel(personId: string, nowSeconds: number = Math.floor(Date.now() / 1000)): ActivityLevel {
  const rows = db
    .select({
      action: auditLog.action,
      days: sql<number>`count(distinct ${auditLog.createdAt} / 86400)`,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.personId, personId),
        inArray(auditLog.action, Object.keys(ACTION_WEIGHTS)),
        gte(auditLog.createdAt, nowSeconds - ACTIVITY_WINDOW_SECONDS),
      ),
    )
    .groupBy(auditLog.action)
    .all();
  const points = rows.reduce((sum, r) => sum + r.days * (ACTION_WEIGHTS[r.action] ?? 0), 0);
  return levelForPoints(points);
}
