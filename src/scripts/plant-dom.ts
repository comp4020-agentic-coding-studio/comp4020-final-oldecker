// Shared between water-plant.ts (your own click) and live.ts (someone
// else's watering, arriving over SSE) --- both need to do the exact same
// DOM update, so it lives in one place rather than two copies that could
// drift.
import { plantSvgForStage, type PlantStage } from "../lib/plant-art";

const plantEl = document.querySelector<HTMLElement>("#plant");
const plantSvg = plantEl?.querySelector("svg");
const stageLabel = document.querySelector<HTMLElement>("#plant-stage");
const waterCan = document.querySelector<HTMLButtonElement>("#water-can");
const nameHeading = document.querySelector<HTMLElement>("#plant-name");
// Baseline for applyPlantName's "don't clobber a mid-edit" check below ---
// without this, the very first update (your own rename included) has
// nothing to compare against and silently skips syncing the input.
if (nameHeading) nameHeading.dataset.previous = nameHeading.textContent ?? "";

export function applyPlantHealth(health: { stage: PlantStage; waterersThisWeek: number }): void {
  plantEl?.setAttribute("data-stage", health.stage);
  if (plantSvg) plantSvg.innerHTML = plantSvgForStage(health.stage);
  if (stageLabel)
    stageLabel.textContent = `${health.waterersThisWeek} of ${waterCan?.dataset.threshold ?? "?"} this week`;
  plantEl?.classList.add("just-watered");
  setTimeout(() => plantEl?.classList.remove("just-watered"), 900);
}

export function applyPlantName(name: string): void {
  const heading = document.querySelector<HTMLElement>("#plant-name");
  const input = document.querySelector<HTMLInputElement>('#rename-plant-form input[name="name"]');
  if (heading) heading.textContent = name;
  // Don't clobber a name someone's mid-typing in their own rename box ---
  // only sync the field when it still matches what was there before.
  if (input && input.value === heading?.dataset.previous) input.value = name;
  if (heading) heading.dataset.previous = name;
}
