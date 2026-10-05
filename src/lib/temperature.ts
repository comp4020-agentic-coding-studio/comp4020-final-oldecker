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
