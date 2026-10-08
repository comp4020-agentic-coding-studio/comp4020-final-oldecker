// Shared between water-plant.ts (your own click) and live.ts (someone
// else's watering, arriving live over SSE) --- the can visually travels
// from where it sits over to the plant and tips to pour there, rather than
// tilting in place next to it. `--travel-x`/`--travel-y` are measured here
// (not hardcoded) so this keeps working whatever the actual layout puts
// between the can and the plant.
const can = document.querySelector<HTMLButtonElement>("#water-can");
const plantEl = document.querySelector<HTMLElement>("#plant");
const POUR_MS = 1000;

export function pourIntoPlant(): Promise<void> {
  return new Promise((resolve) => {
    if (!can || can.classList.contains("pouring")) {
      resolve();
      return;
    }
    if (plantEl) {
      const canRect = can.getBoundingClientRect();
      const plantRect = plantEl.getBoundingClientRect();
      const dx = plantRect.left + plantRect.width / 2 - (canRect.left + canRect.width / 2);
      const dy = plantRect.top - canRect.top - 10; // hover just above the foliage, not centred on it
      can.style.setProperty("--travel-x", `${dx}px`);
      can.style.setProperty("--travel-y", `${dy}px`);
    }
    can.classList.add("pouring");
    setTimeout(() => {
      can.classList.remove("pouring");
      resolve();
    }, POUR_MS);
  });
}
