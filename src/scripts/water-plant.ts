// Your own plant actions: tapping the watering can, and renaming it.
// Someone *else* doing either arrives through live.ts instead.
import { applyPlantHealth, applyPlantName } from "./plant-dom";
import { pourIntoPlant } from "./water-pour";

const can = document.querySelector<HTMLButtonElement>("#water-can");

can?.addEventListener("click", async () => {
  if (can.disabled) return;
  can.disabled = true;
  const pour = pourIntoPlant(); // starts immediately; runs alongside the request, not after it
  try {
    const res = await fetch("/api/water", { method: "POST" });
    if (res.ok) applyPlantHealth(await res.json());
  } finally {
    await pour;
    can.disabled = false;
  }
});

// The name tag is just text until you click it --- then it hides and the
// edit field takes its place, instead of both being visible at once.
const nameButton = document.querySelector<HTMLButtonElement>("#plant-name");
const renameForm = document.querySelector<HTMLFormElement>("#rename-plant-form");
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

  const res = await fetch("/api/plant/name", { method: "POST", body: new URLSearchParams({ name }) });
  if (res.ok) applyPlantName((await res.json()).name);
  closeEditor();
});

// Changing your mind shouldn't need a submit --- Escape backs out without
// saving, same as clicking the name again would feel like it should.
renameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeEditor();
});
