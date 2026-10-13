// Shared between water-plant.ts (your own click) and live.ts (someone
// else's watering, arriving live over SSE) --- the can visually travels
// from where it sits over to the plant and tips to pour there, rather than
// tilting in place next to it. `--travel-x`/`--travel-y` are measured here
// (not hardcoded) so this keeps working whatever the actual layout puts
// between the can and the plant.
const can = document.querySelector<HTMLButtonElement>("#water-can");
const plantEl = document.querySelector<HTMLElement>("#plant");
const POUR_MS = 1000;

// How far a drop actually falls --- must match @keyframes drip's
// translateY(16px) in index.astro, since the target below is picked so that
// fall lands the drop ON the soil, not 16px short of or past it.
const DROP_FALL_PX = 16;

export function pourIntoPlant(): Promise<void> {
  return new Promise((resolve) => {
    if (!can || can.classList.contains("pouring")) {
      resolve();
      return;
    }
    // .plant-soil is the pot itself (src/lib/plant-art.ts), which keeps the
    // same footprint across every growth stage --- aiming at its actual
    // rect, rather than the whole plant's (leaves and all), is what gets
    // the can over the soil instead of hovering above the foliage.
    const soilEl = plantEl?.querySelector<SVGElement>(".plant-soil");
    const dropEl = can.querySelector<HTMLElement>(".drop");
    if (soilEl && dropEl) {
      const soilRect = soilEl.getBoundingClientRect();
      const dropRect = dropEl.getBoundingClientRect();
      // Just left of the soil's centre, not dead-centre: a can pours down
      // and to the right into the pot, not straight down the middle.
      const targetX = soilRect.left + soilRect.width * 0.3;
      // Hover high enough above the soil that the fall's last 16px actually
      // lands on it, instead of stopping mid-air or overshooting into it.
      const targetY = soilRect.top - DROP_FALL_PX;
      const dx = targetX - (dropRect.left + dropRect.width / 2);
      const dy = targetY - dropRect.top;
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
