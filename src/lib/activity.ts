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
//
// On top of that, a weekly streak bonus (PROCESS.md, "Weekly streaks, not
// daily ones"): the rules and numbers are in levels.ts (streakFromWeeks,
// streakBonus), the week boundaries in week.ts; streaksFor() below is the
// query.
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  ACTION_WEIGHTS,
  levelForPoints,
  STREAK_LOOKBACK_WEEKS,
  streakBonus,
  streakFromWeeks,
  type ActivityLevel,
} from "./levels";
import { auditLog, houseMembers, people } from "./schema";
import { canberraDay, canberraWeekStarts } from "./week";

export { ACTION_WEIGHTS, LEVELS, levelForPoints, type ActivityLevel } from "./levels";

export const ACTIVITY_WINDOW_SECONDS = 7 * 24 * 60 * 60;

const nowSecs = () => Math.floor(Date.now() / 1000);

// Everyone's level in one grouped query, not one query per person: a house
// page needs a level for every member (leaderboard + badges, ~15 people), and
// every presence broadcast needs one for everyone in the corridor. The
// (person_id, action, created_at) index covers the whole WHERE clause.
// People with no activity in the window aren't in the result set, so they
// default to level 1 / 0 points.
//
// A second grouped query (streaksFor) adds each person's weekly streak, and
// its bonus goes into the same `points`, so the cooldown, the leaderboard
// order and the level-up announcement all see it without knowing about it.
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
  const streaks = streaksFor(ids, nowSeconds);
  return new Map(
    [...points].map(([id, p]): [string, ActivityLevel] => {
      const st = streaks.get(id) ?? NO_STREAK;
      return [id, levelForPoints(p + streakBonus(st.streak), st.streak, st.countedThisWeek)];
    }),
  );
}

export function activityLevel(personId: string, nowSeconds: number = nowSecs()): ActivityLevel {
  return levelsFor([personId], nowSeconds).get(personId) ?? levelForPoints(0);
}

export interface Streak {
  streak: number;
  countedThisWeek: boolean;
}
const NO_STREAK: Streak = { streak: 0, countedThisWeek: false };

// Which Canberra weeks each person did anything in, over the last year, in
// one grouped query: every audit_log row of theirs is put in a week bucket
// (0 = this week) by a CASE over the exact week starts week.ts computed, so
// SQLite never has to know about time zones or DST. At most 52 rows per
// person come back. Any action counts, weighted or not.
export function streaksFor(personIds: readonly string[], nowSeconds: number = nowSecs()): Map<string, Streak> {
  const ids = [...new Set(personIds)];
  const result = new Map<string, Streak>(ids.map((id) => [id, NO_STREAK]));
  if (ids.length === 0) return result;
  const starts = canberraWeekStarts(nowSeconds, STREAK_LOOKBACK_WEEKS);
  // Only integers computed right here go into the raw SQL, never input.
  const bucket = sql.raw(`CASE ${starts.map((s, i) => `WHEN created_at >= ${Math.floor(s)} THEN ${i}`).join(" ")} END`);
  const rows = db
    .select({ personId: auditLog.personId, week: sql<number | null>`${bucket}` })
    .from(auditLog)
    .where(and(inArray(auditLog.personId, ids), gte(auditLog.createdAt, starts[starts.length - 1])))
    .groupBy(auditLog.personId, bucket)
    .all();
  const weeks = new Map<string, Set<number>>();
  for (const r of rows) {
    if (!r.personId || r.week === null) continue;
    let set = weeks.get(r.personId);
    if (!set) weeks.set(r.personId, (set = new Set()));
    set.add(Number(r.week));
  }
  for (const [id, set] of weeks) result.set(id, { streak: streakFromWeeks(set), countedThisWeek: set.has(0) });
  return result;
}

// Opening a house page counts as showing up for the streak, even if all you
// do is look: the quiet people the app is for are exactly the ones who read
// and don't post. Sessions are long-lived cookies, so "login" is rare and
// can't stand in for it. Logged at most once per Canberra day per person
// (not per house, not per page load), so the audit log gets one quiet line
// a day. `log` is logAction bound by the caller: audit.ts imports this file,
// so this file can't import it back.
export function recordVisitOncePerDay(personId: string, log: () => void, now: Date = new Date()): boolean {
  const last = db
    .select({ createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(and(eq(auditLog.personId, personId), eq(auditLog.action, "house_visit")))
    .orderBy(desc(auditLog.createdAt))
    .limit(1)
    .get();
  if (last && canberraDay(new Date(last.createdAt * 1000)) === canberraDay(now)) return false;
  log();
  return true;
}

export interface LeaderboardRow {
  personId: string;
  name: string;
  avatar: string;
  level: number;
  points: number;
  streak: number;
  countedThisWeek: boolean;
  rank: number;
}

// This house's members, most active first: three queries in total (members,
// then everyone's points and streaks at once), whatever the house's size.
// Ties share a rank ("1, 1, 3"), and are listed by name so the order is
// stable.
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
      return { ...m, level: l.level, points: l.points, streak: l.streak, countedThisWeek: l.countedThisWeek, rank: 0 };
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
