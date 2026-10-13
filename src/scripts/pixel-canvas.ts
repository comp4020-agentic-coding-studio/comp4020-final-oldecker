// Your own placements on the shared pixel canvas. A pixel someone ELSE
// places arrives through live.ts instead (same split as the plant: your own
// action here, everyone else's over SSE).
import { PALETTE, PLACE_COOLDOWN_SECONDS } from "../lib/canvas";

const svg = document.querySelector<SVGSVGElement>("#pixel-canvas");
const cooldownLabel = document.querySelector<HTMLElement>("#canvas-cooldown");
const swatches = document.querySelectorAll<HTMLButtonElement>(".canvas-swatch");

let selectedColor = 0;
let cooldownUntil = 0; // unix seconds; 0 means "not on cooldown"
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const initialRemaining = Number(cooldownLabel?.dataset.cooldown ?? "0");
if (initialRemaining > 0) startCooldown(initialRemaining);

for (const swatch of swatches) {
  swatch.addEventListener("click", () => {
    selectedColor = Number(swatch.dataset.colorIndex ?? "0");
    for (const s of swatches) s.setAttribute("aria-pressed", String(s === swatch));
  });
}

function startCooldown(seconds: number): void {
  cooldownUntil = Math.floor(Date.now() / 1000) + seconds;
  clearInterval(countdownTimer);
  const tick = () => {
    const remaining = cooldownUntil - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      cooldownUntil = 0;
      if (cooldownLabel) cooldownLabel.textContent = "ready to place";
      return;
    }
    if (cooldownLabel) cooldownLabel.textContent = `wait ${remaining}s to place again`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

svg?.addEventListener("click", async (event) => {
  const rect = (event.target as SVGElement).closest<SVGRectElement>("rect[data-x]");
  if (!rect) return;
  if (cooldownUntil > Math.floor(Date.now() / 1000)) return;

  const x = rect.dataset.x;
  const y = rect.dataset.y;
  if (x === undefined || y === undefined) return;

  const res = await fetch("/api/canvas/pixel", {
    method: "POST",
    body: new URLSearchParams({ x, y, color: String(selectedColor) }),
  });

  if (res.status === 429) {
    const { remaining } = (await res.json()) as { remaining: number };
    startCooldown(remaining);
    return;
  }
  if (!res.ok) return;

  const placed = (await res.json()) as { colorIndex: number };
  rect.setAttribute("fill", PALETTE[placed.colorIndex]?.hex ?? "#ffffff");
  startCooldown(PLACE_COOLDOWN_SECONDS);
});
