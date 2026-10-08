// The ❄️<->🔥 slider's score is -100..100; this is the only place that
// number turns into something shown on screen. Imported both server-side
// (src/pages/index.astro, for the initial render) and by the client script
// (src/scripts/temperature-slider.ts, for live feedback while dragging), so
// the two never drift apart.
export const SCORE_MIN = -100;
export const SCORE_MAX = 100;
// below this magnitude, a vote reads as "no strong feeling" rather than a
// weak lean either way
const NEUTRAL_BAND = 15;
const EXTREME_FROM = 60;

export function emojiForScore(score: number): string {
  const magnitude = Math.abs(score);
  if (magnitude < NEUTRAL_BAND) return "〰️";
  const hot = score > 0;
  return magnitude >= EXTREME_FROM ? (hot ? "🥵" : "🥶") : hot ? "🔥" : "❄️";
}

/** Middle value (average of the two middles for an even count). null for no votes. */
export function median(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** y-position (0 = top) for a score within a strip of the given height, hot
 * end up (like a thermometer) --- top = SCORE_MAX, bottom = SCORE_MIN. */
export function scoreToY(score: number, height: number): number {
  return (height * (SCORE_MAX - score)) / (SCORE_MAX - SCORE_MIN);
}

// Diverging pair (dataviz skill, validated against this app's card surfaces:
// light #ffffff, dark #262019 --- all checks pass both modes). Cold/hot poles
// plus a neutral midpoint for an exact-zero vote or the median tick.
export const COLD = { light: "#2a78d6", dark: "#3987e5" };
export const HOT = { light: "#e34948", dark: "#e66767" };
export const NEUTRAL = { light: "#f0efec", dark: "#383835" };

export function colorForScore(score: number): string {
  // was "var(--temp-neutral)" --- a variable that was never actually
  // defined (the CSS custom property is --temp-neutral-ink); caught while
  // wiring this function into actual use below.
  return score === 0 ? "var(--temp-neutral-ink)" : score < 0 ? "var(--temp-cold)" : "var(--temp-hot)";
}

export interface TempDot {
  x: number;
  y: number;
  color: string;
}

/** Dot positions for the strip plot: shared by the server render
 * (src/pages/index.astro) and the client-side redraw after you vote
 * (src/scripts/temperature-slider.ts) --- the whole point is that your own
 * vote lands in exactly the same spot a reload would put it. */
export function layoutDots(scores: number[], width: number, height: number): TempDot[] {
  // near-identical scores get a small deterministic jitter so their dots
  // don't fully overlap --- not a statistical jitter, just legibility
  const seen = new Map<number, number>();
  return scores.map((s) => {
    const bucket = Math.round(s / 8);
    const i = seen.get(bucket) ?? 0;
    seen.set(bucket, i + 1);
    return { x: width / 2 + ((i % 3) - 1) * 5, y: scoreToY(s, height), color: colorForScore(s) };
  });
}
