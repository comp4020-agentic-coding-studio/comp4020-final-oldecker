// The activity level's pure parts: the curve, the weights, the wording, and
// the badge markup. No server-only import here (same constraint as canvas.ts
// and face.ts): the server page, the API routes and the client scripts all
// use this one file, so a level can't mean one thing on the server and
// another in the browser. The database half (counting points out of
// audit_log) is src/lib/activity.ts.
//
// Levels used to be private; they're now shown to everyone in the house ---
// see PROCESS.md, "Activity levels go public".

// Each distinct (action type, UTC day) in the last 7 days earns that action's
// weight once. Pixel placing is worth little on purpose: alone it tops out at
// 7 points, level 2, so the wall can't be levelled up by painting the wall.
export const ACTION_WEIGHTS: Readonly<Record<string, number>> = {
  post_create: 4,
  water: 3,
  post_score: 2,
  party_join: 2,
  pixel_place: 1,
};

// What to call each action in the "how to earn points" hints, in the order
// they're listed (biggest first).
export const ACTION_HINTS: ReadonlyArray<{ action: string; label: string }> = [
  { action: "post_create", label: "post" },
  { action: "water", label: "water the plant" },
  { action: "post_score", label: "rate a post" },
  { action: "party_join", label: "join the party room" },
  { action: "pixel_place", label: "place a pixel" },
];

// [minimum points, pixel cooldown seconds]; index + 1 is the level.
// 10 min -> 5 min -> 2 min -> 1 min -> 30 s: the base wait is long enough
// that a pixel is a small decision, and the top level is twenty times faster.
export const LEVELS: ReadonlyArray<readonly [number, number]> = [
  [0, 600],
  [4, 300],
  [10, 120],
  [18, 60],
  [28, 30],
];

export const MAX_LEVEL = LEVELS.length;

// `points` already includes the streak bonus; `streak` and
// `countedThisWeek` are carried along so a badge can show the flame.
export type ActivityLevel = {
  level: number;
  points: number;
  cooldownSeconds: number;
  streak: number;
  countedThisWeek: boolean;
};

// --- the weekly streak (PROCESS.md, "Weekly streaks") ---------------------
// A Canberra calendar week (Monday 00:00) counts if you did anything at all
// in it --- any audit_log row that's yours, including just opening a house
// page (a "house_visit", logged once a day). The streak is how many counted
// weeks in a row end at this week, or at last week: this week isn't broken
// until it's over, so a streak through last week stays alive until Sunday
// night.
//
// It adds to your level's points: +1 per streak week from 2 weeks on, up to
// +8. Small next to what a single good week earns (28 for the top level), so
// it can't carry anyone up the ladder by itself --- showing up once a week
// for two months and doing nothing else lands you at level 2 --- but for
// someone who posts once a week it's the difference between level 2 and 3.
export const STREAK_MIN_SHOWN = 2;
export const STREAK_BONUS_CAP = 8;
// How far back a streak is counted. Past this it just reads "52".
export const STREAK_LOOKBACK_WEEKS = 52;

// `activeWeeks` holds week indexes, 0 = this week, 1 = last week, and so on.
export function streakFromWeeks(activeWeeks: ReadonlySet<number>): number {
  let week = activeWeeks.has(0) ? 0 : 1;
  let streak = 0;
  while (activeWeeks.has(week) && week < STREAK_LOOKBACK_WEEKS) {
    streak++;
    week++;
  }
  return streak;
}

export function streakBonus(streak: number): number {
  return streak >= STREAK_MIN_SHOWN ? Math.min(streak, STREAK_BONUS_CAP) : 0;
}

export function clampStreak(streak: unknown): number {
  const n = Math.round(Number(streak));
  return Number.isFinite(n) ? Math.min(STREAK_LOOKBACK_WEEKS, Math.max(0, n)) : 0;
}

// The words under your own progress bar.
export function streakLine(streak: number, countedThisWeek: boolean): string {
  const s = clampStreak(streak);
  const run = s === 0 ? "no streak yet" : `${s}-week streak`;
  const bonus = streakBonus(s);
  const extra = bonus > 0 ? ` (+${bonus} pts)` : "";
  const week = countedThisWeek
    ? "this week: ✓ counted"
    : "this week: not yet, anything you do here before Sunday night counts";
  return `${run}${extra} · ${week}`;
}

// A small flame drawn in currentColor, not the 🔥 emoji: emoji render at
// different sizes and weights per platform and would clash with the
// level badge's flat numeral right next to it.
export const FLAME_ICON =
  '<svg viewBox="0 0 12 14" aria-hidden="true"><path d="M6 0c.4 2.2 3.8 3.9 3.8 7.6A3.8 3.8 0 0 1 6 13.4a3.8 3.8 0 0 1-3.8-3.8c0-1.7.9-2.7 1.7-3.4.1 1.1.6 1.9 1.4 2.2C5 6.2 4.6 3.4 6 0z"/></svg>';

// The streak pill on an avatar; empty under STREAK_MIN_SHOWN, since a
// one-week "streak" is just "was here this week".
export function streakBadgeHtml(streak: unknown): string {
  const s = clampStreak(streak);
  if (s < STREAK_MIN_SHOWN) return "";
  return `<span class="lvl-streak" role="img" aria-label="${s}-week streak">${FLAME_ICON}${s}</span>`;
}

export function levelForPoints(points: number, streak = 0, countedThisWeek = false): ActivityLevel {
  let idx = 0;
  for (const [i, [min]] of LEVELS.entries()) if (points >= min) idx = i;
  return { level: idx + 1, points, cooldownSeconds: LEVELS[idx][1], streak, countedThisWeek };
}

// Anything that arrives over the wire is clamped before it becomes a class
// name or a number in markup.
export function clampLevel(level: unknown): number {
  const n = Math.round(Number(level));
  return Number.isFinite(n) ? Math.min(MAX_LEVEL, Math.max(1, n)) : 1;
}

// How far through the current level you are, for the progress bar.
export function levelProgress(points: number): {
  level: number;
  nextLevel: number | null;
  pointsToNext: number;
  fraction: number;
} {
  const { level } = levelForPoints(points);
  if (level >= MAX_LEVEL) return { level, nextLevel: null, pointsToNext: 0, fraction: 1 };
  const floor = LEVELS[level - 1][0];
  const ceiling = LEVELS[level][0];
  return {
    level,
    nextLevel: level + 1,
    pointsToNext: ceiling - points,
    fraction: Math.min(1, Math.max(0, (points - floor) / (ceiling - floor))),
  };
}

// "every 10 min", "every 30s" --- the cadence a level gives you.
export function formatCadence(seconds: number): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds}s`;
}

// A countdown: "4m 32s", "1m 05s", "42s".
export function formatWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function levelLine(level: number, cooldownSeconds: number): string {
  return `level ${level} · you can place every ${formatCadence(cooldownSeconds)}`;
}

export function progressLine(points: number): string {
  const p = levelProgress(points);
  if (p.nextLevel === null) return `${points} pts · top level`;
  return `${points} pts · ${p.pointsToNext} more to level ${p.nextLevel}`;
}

// The level badge + ring, wrapped around any avatar circle. The SSR twin is
// src/components/LevelFlair.astro; both must produce the same markup so a
// chip built live over SSE looks exactly like one from the first render.
// Only numbers go into it (clamped above), and `inner` is avatar SVG built
// from face.ts's constants --- no user string is ever interpolated here.
// The streak pill (if any) comes after the level badge, so `> :first-child`
// is still the avatar.
export function flairHtml(level: unknown, inner: string, streak: unknown = 0): string {
  const lv = clampLevel(level);
  const st = clampStreak(streak);
  return `<span class="lvl-flair" data-level="${lv}" data-streak="${st}">${inner}<span class="lvl-badge" role="img" aria-label="level ${lv}">${lv}</span>${streakBadgeHtml(st)}</span>`;
}
