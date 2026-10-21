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

export type ActivityLevel = { level: number; points: number; cooldownSeconds: number };

export function levelForPoints(points: number): ActivityLevel {
  let idx = 0;
  for (const [i, [min]] of LEVELS.entries()) if (points >= min) idx = i;
  return { level: idx + 1, points, cooldownSeconds: LEVELS[idx][1] };
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
export function flairHtml(level: unknown, inner: string): string {
  const lv = clampLevel(level);
  return `<span class="lvl-flair" data-level="${lv}">${inner}<span class="lvl-badge" role="img" aria-label="level ${lv}">${lv}</span></span>`;
}
