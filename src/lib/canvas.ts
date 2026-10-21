// The shared pixel canvas's fixed shape, and the cooldown math --- shared
// between the server render (src/pages/index.astro), the API route
// (src/pages/api/canvas/pixel.ts), and the client script
// (src/scripts/pixel-canvas.ts), so none of them can drift on the grid size
// or the palette. No server-only import here (same constraint as
// plant-art.ts/temperature.ts): this has to be safe to bundle for the
// browser too.
export const CANVAS_SIZE = 32;
// The base (level 1) cooldown; a person's real one comes from their activity
// level (the curve is src/lib/levels.ts, the counting src/lib/activity.ts).
export const PLACE_COOLDOWN_SECONDS = 600;

// A small, fixed palette rather than a free colour picker --- same "legible
// at a glance, not infinite choice" reasoning as the avatars replacing a
// colour swatch at join (see schema.ts's comment on people.avatar).
export const PALETTE: ReadonlyArray<{ hex: string }> = [
  { hex: "#ffffff" },
  { hex: "#d4d7d9" },
  { hex: "#898d90" },
  { hex: "#2b2420" },
  { hex: "#f3dde3" },
  { hex: "#e34948" },
  { hex: "#e8a33d" },
  { hex: "#f6d94a" },
  { hex: "#9ccb7e" },
  { hex: "#3f6b32" },
  { hex: "#7fc6d9" },
  { hex: "#2a78d6" },
  { hex: "#3a3a9c" },
  { hex: "#b48ce0" },
];

export function isValidCoord(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < CANVAS_SIZE;
}

export function isValidColorIndex(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n < PALETTE.length;
}

/** Seconds still to wait, given the last placement's unix timestamp; 0 once the cooldown has fully elapsed. */
export function cooldownRemaining(
  lastPlacedAt: number | null,
  cooldownSeconds: number = PLACE_COOLDOWN_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): number {
  if (lastPlacedAt === null) return 0;
  return Math.max(0, cooldownSeconds - (nowSeconds - lastPlacedAt));
}
