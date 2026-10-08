// "the place you drop it determines the emoji": the emoji updates live on
// every drag frame (`input`), but the score is only sent to the server once
// you let go (`change`) --- not on every intermediate pixel of the drag.
//
// Elements are found via .closest(".post-temp") + a query inside it, not
// slider.parentElement --- the slider's immediate parent is .temp-slider-wrap,
// not a container shared with .temp-emoji/.temp-strip/.temp-median-label (they're
// siblings one level further up). An earlier version used parentElement
// directly and silently found nothing once the slider moved to the side.
import { emojiForScore, layoutDots, median, scoreToY } from "../lib/temperature";

for (const slider of document.querySelectorAll<HTMLInputElement>(".temp-slider")) {
  const container = slider.closest<HTMLElement>(".post-temp");
  const postId = slider.dataset.postId;
  const emojiEl = container?.querySelector<HTMLElement>(".temp-emoji");
  const svg = container?.querySelector<SVGSVGElement>(".temp-strip");
  const medianLabel = container?.querySelector<HTMLElement>(".temp-median-label");

  const updateEmoji = () => {
    if (emojiEl) emojiEl.textContent = emojiForScore(Number(slider.value));
  };
  updateEmoji();

  function redrawStrip(scores: number[]): void {
    if (!svg) return;
    const width = svg.viewBox.baseVal.width || Number(svg.getAttribute("width")) || 20;
    const height = svg.viewBox.baseVal.height || Number(svg.getAttribute("height")) || 96;

    const dots = layoutDots(scores, width, height)
      .map((d) => `<circle cx="${d.x}" cy="${d.y}" r="4" fill="${d.color}" stroke="var(--card)" stroke-width="2" />`)
      .join("");
    const med = median(scores);
    const tick =
      med === null
        ? ""
        : `<line x1="1" y1="${scoreToY(med, height)}" x2="${width - 1}" y2="${scoreToY(med, height)}" class="temp-median-tick" />`;
    svg.innerHTML = dots + tick;

    if (medianLabel) {
      medianLabel.textContent = med === null ? "–" : emojiForScore(med);
      medianLabel.title = med === null ? "no votes yet" : `median: ${Math.round(med)}`;
    }
  }

  slider.addEventListener("input", updateEmoji);
  slider.addEventListener("change", async () => {
    if (!postId) return;
    try {
      const res = await fetch(`/api/posts/${postId}/score`, {
        method: "POST",
        body: new URLSearchParams({ score: slider.value }),
      });
      if (res.ok) redrawStrip(((await res.json()) as { scores: number[] }).scores);
    } catch {
      // a dropped vote isn't worth interrupting anyone over; it just won't
      // show up in the strip (or count towards "extremest" sorting) until
      // they move the slider again
    }
  });
}
