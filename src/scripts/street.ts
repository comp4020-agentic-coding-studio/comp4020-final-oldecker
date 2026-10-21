// The street page: drag your avatar off the pavement onto one of your
// houses to go in. Same drag gesture as the house page (drag.ts); every
// house is a drop zone whose drop is just a navigation. Each house is also
// a plain link, so tapping works without dragging.
import { dragFrom } from "./drag";

const you = document.querySelector<HTMLElement>("#street-you[data-draggable]");
const lots = [...document.querySelectorAll<HTMLAnchorElement>(".house-lot")];

you?.addEventListener("pointerdown", (e) => {
  dragFrom(you, e, {
    zones: lots.map((el) => ({
      el,
      onDrop: () => {
        window.location.href = el.dataset.href ?? el.href;
      },
    })),
  });
});
