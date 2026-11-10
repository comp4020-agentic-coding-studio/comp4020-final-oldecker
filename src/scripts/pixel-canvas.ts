// Your own placements on the shared pixel canvas. A pixel someone ELSE
// places arrives through live.ts instead (same split as the plant: your own
// action here, everyone else's over SSE).
import { cooldownRingOffset, PALETTE } from "../lib/canvas";
import { formatWait } from "../lib/levels";
import { applyCanvasName } from "./canvas-dom";
import { houseUrl } from "./house-context";
import { applyLevel } from "./level-dom";

const svg = document.querySelector<SVGSVGElement>("#pixel-canvas");
const cooldownLabel = document.querySelector<HTMLElement>("#canvas-cooldown");
const cooldownRing = document.querySelector<HTMLElement>("#cooldown-ring");
const cooldownRingFill = document.querySelector<SVGCircleElement>("#cooldown-ring-fill");
const ownPersonId = document.querySelector<HTMLElement>("#level-progress")?.dataset.personId ?? "";
const swatches = document.querySelectorAll<HTMLButtonElement>(".canvas-swatch");

const nowSecs = () => Math.floor(Date.now() / 1000);

let selectedColor = 0;
let cooldownUntil = 0; // unix seconds; 0 means "not on cooldown"
// How long the wait in progress was meant to be in total, so a level-up
// mid-wait can work out when the placement that started it happened.
let cooldownLength = 0;
// The ring ticks on requestAnimationFrame rather than a once-a-second
// setInterval: the arc itself (stroke-dashoffset, one attribute write) can
// then move smoothly between the once-a-second text updates, instead of
// jumping in the same steps as the "7m 32s" label. No full SVG rebuild
// either tick --- just the one attribute and the one text node.
let rafId: number | undefined;
let lastLabelSecond = -1;

const initialRemaining = Number(cooldownLabel?.dataset.cooldown ?? "0");
const initialLength = Number(document.querySelector<HTMLElement>("#canvas-level")?.dataset.cooldownSeconds ?? "0");
if (initialRemaining > 0) startCooldown(initialRemaining, initialLength || initialRemaining);

for (const swatch of swatches) {
  swatch.addEventListener("click", () => {
    selectedColor = Number(swatch.dataset.colorIndex ?? "0");
    for (const s of swatches) s.setAttribute("aria-pressed", String(s === swatch));
  });
}

function setReady(): void {
  cooldownUntil = 0;
  cooldownRing?.setAttribute("data-cooldown", "0");
  if (cooldownLabel) {
    cooldownLabel.textContent = "ready";
    cooldownLabel.dataset.cooldown = "0";
  }
  cooldownRingFill?.setAttribute("stroke-dashoffset", String(cooldownRingOffset(0)));
}

function startCooldown(seconds: number, length: number): void {
  cooldownUntil = nowSecs() + seconds;
  cooldownLength = length;
  cooldownRing?.setAttribute("data-cooldown", String(seconds));
  cooldownRing?.setAttribute("data-cooldown-length", String(length));
  lastLabelSecond = -1;
  if (rafId !== undefined) cancelAnimationFrame(rafId);

  const frame = () => {
    const remainingMs = cooldownUntil * 1000 - Date.now();
    if (remainingMs <= 0) {
      setReady();
      rafId = undefined;
      return;
    }
    const remainingSeconds = remainingMs / 1000;
    const fraction = length > 0 ? remainingSeconds / length : 0;
    cooldownRingFill?.setAttribute("stroke-dashoffset", String(cooldownRingOffset(fraction)));
    // The text only needs to change once a second, not every frame.
    const whole = Math.ceil(remainingSeconds);
    if (whole !== lastLabelSecond) {
      lastLabelSecond = whole;
      if (cooldownLabel) {
        cooldownLabel.textContent = formatWait(remainingSeconds);
        cooldownLabel.dataset.cooldown = String(whole);
      }
    }
    rafId = requestAnimationFrame(frame);
  };
  frame();
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
    const { remaining, level, points, cooldownSeconds, streak, countedThisWeek } = (await res.json()) as {
      remaining: number;
      level: number;
      points: number;
      cooldownSeconds: number;
      streak: number;
      countedThisWeek: boolean;
    };
    startCooldown(remaining, cooldownSeconds);
    applyLevel(ownPersonId, level, points, streak, countedThisWeek);
    return;
  }
  if (!res.ok) return;

  const placed = (await res.json()) as {
    colorIndex: number;
    cooldownSeconds: number;
    level: number;
    points: number;
    streak: number;
    countedThisWeek: boolean;
  };
  rect.setAttribute("fill", PALETTE[placed.colorIndex]?.hex ?? "#ffffff");
  // Countdown first, so a level-up this placement caused doesn't then
  // "shorten" a wait that already uses the new cooldown.
  startCooldown(placed.cooldownSeconds, placed.cooldownSeconds);
  applyLevel(ownPersonId, placed.level, placed.points, placed.streak, placed.countedThisWeek);
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
