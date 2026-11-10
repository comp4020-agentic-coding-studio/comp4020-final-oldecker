// Wires up every InfoButton on the page (src/components/InfoButton.astro) by
// delegation, so each house page only pays for one listener set no matter
// how many info buttons it renders. Click toggles the popover next to the
// button that was clicked; Esc or a click outside the open popover closes
// it. This file is imported once per InfoButton instance in the markup
// (Astro de-dupes repeated <script src> imports of the same module), so it
// must be safe to "load" more than once --- it only ever attaches document-
// level listeners, which it does exactly once via a window flag.

function closeAll(except?: HTMLElement): void {
  document.querySelectorAll<HTMLButtonElement>("[data-info-btn]").forEach((btn) => {
    if (btn === except) return;
    const pop = document.getElementById(btn.getAttribute("aria-controls") ?? "");
    if (pop && !pop.hidden) {
      pop.hidden = true;
      pop.style.left = "";
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

// The popover is positioned absolute against its own inline wrapper
// (.info-wrap), which can sit anywhere horizontally --- several of these
// buttons live at the right edge of a heading on a 390px phone. A plain
// `left: 0` would run the popover straight off the viewport there, so once
// it's shown, nudge it left just enough to stay on screen with an 8px
// margin either side; never further right than 0 (its natural position).
function clampToViewport(wrap: HTMLElement, pop: HTMLElement): void {
  pop.style.left = "0";
  const wrapRect = wrap.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 8;
  const overflowRight = wrapRect.left + popRect.width + margin - window.innerWidth;
  if (overflowRight > 0) {
    const shift = Math.min(overflowRight, wrapRect.left - margin);
    pop.style.left = `${-shift}px`;
  }
}

function init(): void {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>("[data-info-btn]");
    if (btn) {
      const pop = document.getElementById(btn.getAttribute("aria-controls") ?? "");
      if (!pop) return;
      const willOpen = pop.hidden;
      closeAll(btn);
      pop.hidden = !willOpen;
      btn.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        const wrap = btn.closest<HTMLElement>(".info-wrap");
        if (wrap) clampToViewport(wrap, pop);
      }
      return;
    }
    // outside click: close whatever's open, unless it's a click inside an
    // open popover itself (the text is selectable, so clicking it shouldn't
    // dismiss it)
    if (!target.closest(".info-pop")) closeAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
}

const w = window as unknown as { __infoButtonInit?: boolean };
if (!w.__infoButtonInit) {
  w.__infoButtonInit = true;
  init();
}
