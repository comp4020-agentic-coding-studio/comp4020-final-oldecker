// Your own placements on the shared pixel canvas. A pixel someone ELSE
// places arrives through live.ts instead (same split as the plant: your own
// action here, everyone else's over SSE).
import { PALETTE } from "../lib/canvas";
import { applyCanvasName } from "./canvas-dom";

const svg = document.querySelector<SVGSVGElement>("#pixel-canvas");
const cooldownLabel = document.querySelector<HTMLElement>("#canvas-cooldown");
const levelLabel = document.querySelector<HTMLElement>("#canvas-level");
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

function showLevel(level: number, cooldownSeconds: number): void {
  if (levelLabel) levelLabel.textContent = `level ${level} · you can place every ${cooldownSeconds}s`;
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
    const { remaining, level, cooldownSeconds } = (await res.json()) as {
      remaining: number;
      level: number;
      cooldownSeconds: number;
    };
    showLevel(level, cooldownSeconds);
    startCooldown(remaining);
    return;
  }
  if (!res.ok) return;

  const placed = (await res.json()) as { colorIndex: number; cooldownSeconds: number; level: number };
  rect.setAttribute("fill", PALETTE[placed.colorIndex]?.hex ?? "#ffffff");
  showLevel(placed.level, placed.cooldownSeconds);
  startCooldown(placed.cooldownSeconds);
});

// Renaming the wall --- identical click-to-edit shape as the plant's own
// rename in water-plant.ts, just pointed at the canvas's own ids/route.
const nameButton = document.querySelector<HTMLButtonElement>("#canvas-name");
const renameForm = document.querySelector<HTMLFormElement>("#rename-canvas-form");
const renameInput = renameForm?.querySelector<HTMLInputElement>('input[name="name"]');

function openEditor(): void {
  if (!renameForm || !nameButton || !renameInput) return;
  nameButton.hidden = true;
  renameForm.hidden = false;
  renameInput.value = nameButton.textContent ?? "";
  renameInput.focus();
  renameInput.select();
}

function closeEditor(): void {
  if (!renameForm || !nameButton) return;
  renameForm.hidden = true;
  nameButton.hidden = false;
}

nameButton?.addEventListener("click", openEditor);

renameForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = renameInput?.value.trim();
  if (!name) return;

  const res = await fetch("/api/canvas/name", { method: "POST", body: new URLSearchParams({ name }) });
  if (res.ok) applyCanvasName((await res.json()).name);
  closeEditor();
});

renameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditor();
});
