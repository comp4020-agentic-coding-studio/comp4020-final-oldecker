// Your own placements on the shared pixel canvas. A pixel someone ELSE
// places arrives through live.ts instead (same split as the plant: your own
// action here, everyone else's over SSE).
import { PALETTE } from "../lib/canvas";
import { formatWait } from "../lib/levels";
import { applyCanvasName } from "./canvas-dom";
import { houseUrl } from "./house-context";
import { applyLevel } from "./level-dom";

const svg = document.querySelector<SVGSVGElement>("#pixel-canvas");
const cooldownLabel = document.querySelector<HTMLElement>("#canvas-cooldown");
const ownPersonId = document.querySelector<HTMLElement>("#level-progress")?.dataset.personId ?? "";
const swatches = document.querySelectorAll<HTMLButtonElement>(".canvas-swatch");

const nowSecs = () => Math.floor(Date.now() / 1000);

let selectedColor = 0;
let cooldownUntil = 0; // unix seconds; 0 means "not on cooldown"
// How long the wait in progress was meant to be in total, so a level-up
// mid-wait can work out when the placement that started it happened.
let cooldownLength = 0;
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const initialRemaining = Number(cooldownLabel?.dataset.cooldown ?? "0");
const initialLength = Number(document.querySelector<HTMLElement>("#canvas-level")?.dataset.cooldownSeconds ?? "0");
if (initialRemaining > 0) startCooldown(initialRemaining, initialLength || initialRemaining);

for (const swatch of swatches) {
  swatch.addEventListener("click", () => {
    selectedColor = Number(swatch.dataset.colorIndex ?? "0");
    for (const s of swatches) s.setAttribute("aria-pressed", String(s === swatch));
  });
}

function startCooldown(seconds: number, length: number): void {
  cooldownUntil = nowSecs() + seconds;
  cooldownLength = length;
  clearInterval(countdownTimer);
  const tick = () => {
    const remaining = cooldownUntil - nowSecs();
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      cooldownUntil = 0;
      if (cooldownLabel) cooldownLabel.textContent = "ready to place";
      return;
    }
    // "4m 32s", not "272s": at the low levels the wait is minutes long.
    if (cooldownLabel) cooldownLabel.textContent = `wait ${formatWait(remaining)} to place again`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// Levelling up from anything else (watering, posting, another tab) shortens
// the wait you're already in: the server lets you place once the NEW
// cooldown has passed since your last placement, so the countdown follows.
document.addEventListener("board:my-level", (e) => {
  const { cooldownSeconds } = (e as CustomEvent<{ cooldownSeconds: number }>).detail;
  if (cooldownUntil === 0 || cooldownLength === 0) return;
  const placedAt = cooldownUntil - cooldownLength;
  startCooldown(Math.max(0, placedAt + cooldownSeconds - nowSecs()), cooldownSeconds);
});

svg?.addEventListener("click", async (event) => {
  const rect = (event.target as SVGElement).closest<SVGRectElement>("rect[data-x]");
  if (!rect) return;
  if (cooldownUntil > nowSecs()) return;

  const x = rect.dataset.x;
  const y = rect.dataset.y;
  if (x === undefined || y === undefined) return;

  const res = await fetch(houseUrl("/api/canvas/pixel"), {
    method: "POST",
    body: new URLSearchParams({ x, y, color: String(selectedColor) }),
  });

  if (res.status === 429) {
    const { remaining, level, points, cooldownSeconds } = (await res.json()) as {
      remaining: number;
      level: number;
      points: number;
      cooldownSeconds: number;
    };
    startCooldown(remaining, cooldownSeconds);
    applyLevel(ownPersonId, level, points);
    return;
  }
  if (!res.ok) return;

  const placed = (await res.json()) as { colorIndex: number; cooldownSeconds: number; level: number; points: number };
  rect.setAttribute("fill", PALETTE[placed.colorIndex]?.hex ?? "#ffffff");
  // Countdown first, so a level-up this placement caused doesn't then
  // "shorten" a wait that already uses the new cooldown.
  startCooldown(placed.cooldownSeconds, placed.cooldownSeconds);
  applyLevel(ownPersonId, placed.level, placed.points);
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

  const res = await fetch(houseUrl("/api/canvas/name"), { method: "POST", body: new URLSearchParams({ name }) });
  if (res.ok) applyCanvasName((await res.json()).name);
  closeEditor();
});

renameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditor();
});
