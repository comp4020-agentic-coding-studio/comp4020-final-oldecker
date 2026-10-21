// The street page: drag your avatar off the pavement onto one of your
// houses to go in. Same drag gesture as the house page (drag.ts); every
// house is a drop zone whose drop is just a navigation. Each house is also
// a plain link, so tapping works without dragging.
//
// The houses and the "draggable" flag are read when a drag starts, not at
// load: a door you were waiting at can open while the page is up
// (street-knocks.ts turns it into a house), and it should be a drop target
// straight away.
import { dragFrom } from "./drag";

const you = document.querySelector<HTMLElement>("#street-you");

you?.addEventListener("pointerdown", (e) => {
  if (!you.dataset.draggable) return;
  const lots = [...document.querySelectorAll<HTMLAnchorElement>(".house-lot")];
  dragFrom(you, e, {
    zones: lots.map((el) => ({
      el,
      onDrop: () => {
        window.location.href = el.dataset.href ?? el.href;
      },
    })),
  });
});
