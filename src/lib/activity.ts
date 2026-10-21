// A person's "activity level": derived at read time from audit_log (same
// no-cron, no-stored-counter pattern as plantHealth() in plant.ts). It sets
// their own pixel cooldown and, since the change of mind recorded in
// PROCESS.md ("Activity levels go public"), is shown to everyone in the
// house as a badge, an avatar ring and a leaderboard.
//
// Points: each distinct (action type, UTC day) in the last 7 days earns that
// action's weight once. So ten ratings in one afternoon score the same as
// one, and no single action can be spammed past 7 x its weight. The curve,
// weights and wording live in levels.ts, which is safe to bundle for the
// browser; this file is only the database half.
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { ACTION_WEIGHTS, levelForPoints, type ActivityLevel } from "./levels";
import { auditLog, houseMembers, people } from "./schema";

export { ACTION_WEIGHTS, LEVELS, levelForPoints, type ActivityLevel } from "./levels";

export const ACTIVITY_WINDOW_SECONDS = 7 * 24 * 60 * 60;

const nowSecs = () => Math.floor(Date.now() / 1000);

// Everyone's level in one grouped query, not one query per person: a house
// page needs a level for every member (leaderboard + badges, ~15 people), and
// every presence broadcast needs one for everyone in the corridor. The
// (person_id, action, created_at) index covers the whole WHERE clause.
// People with no activity in the window aren't in the result set, so they
// default to level 1 / 0 points.
export function levelsFor(personIds: readonly string[], nowSeconds: number = nowSecs()): Map<string, ActivityLevel> {
  const ids = [...new Set(personIds)];
  const points = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length > 0) {
    const rows = db
      .select({
        personId: auditLog.personId,
        action: auditLog.action,
        days: sql<number>`count(distinct ${auditLog.createdAt} / 86400)`,
      })
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.personId, ids),
          inArray(auditLog.action, Object.keys(ACTION_WEIGHTS)),
          gte(auditLog.createdAt, nowSeconds - ACTIVITY_WINDOW_SECONDS),
        ),
      )
      .groupBy(auditLog.personId, auditLog.action)
      .all();
    for (const r of rows) {
      if (!r.personId) continue;
      points.set(r.personId, (points.get(r.personId) ?? 0) + r.days * (ACTION_WEIGHTS[r.action] ?? 0));
    }
  }
  return new Map([...points].map(([id, p]) => [id, levelForPoints(p)]));
}

export function activityLevel(personId: string, nowSeconds: number = nowSecs()): ActivityLevel {
  return levelsFor([personId], nowSeconds).get(personId) ?? levelForPoints(0);
}

export interface LeaderboardRow {
  personId: string;
  name: string;
  avatar: string;
  level: number;
  points: number;
  rank: number;
}

// This house's members, most active first: two queries in total (members,
// then everyone's points at once), whatever the house's size. Ties share a
// rank ("1, 1, 3"), and are listed by name so the order is stable.
export function houseLeaderboard(houseId: number, nowSeconds: number = nowSecs()): LeaderboardRow[] {
  const members = db
    .select({ personId: houseMembers.personId, name: people.name, avatar: people.avatar })
    .from(houseMembers)
    .innerJoin(people, eq(people.id, houseMembers.personId))
    .where(eq(houseMembers.houseId, houseId))
    .all();
  const levels = levelsFor(
    members.map((m) => m.personId),
    nowSeconds,
  );
  const rows = members
    .map((m) => {
      const l = levels.get(m.personId) ?? levelForPoints(0);
      return { ...m, level: l.level, points: l.points, rank: 0 };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  for (const [i, row] of rows.entries()) row.rank = i > 0 && rows[i - 1].points === row.points ? rows[i - 1].rank : i + 1;
  return rows;
}

// Which weighted actions this person has already earned points for today
// (UTC day), so the progress bar's hints can say what's still worth doing
// today instead of promising points a repeat won't give.
export function earnedToday(personId: string, nowSeconds: number = nowSecs()): string[] {
  const dayStart = nowSeconds - (nowSeconds % 86400);
  return db
    .selectDistinct({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.personId, personId),
        inArray(auditLog.action, Object.keys(ACTION_WEIGHTS)),
        gte(auditLog.createdAt, dayStart),
      ),
    )
    .all()
    .map((r) => r.action);
}
