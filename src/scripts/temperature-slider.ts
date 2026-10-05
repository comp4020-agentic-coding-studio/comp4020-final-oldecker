// "the place you drop it determines the emoji": the emoji updates live on
// every drag frame (`input`), but the score is only sent to the server once
// you let go (`change`) --- not on every intermediate pixel of the drag.
import { emojiForScore } from "../lib/temperature";

for (const slider of document.querySelectorAll<HTMLInputElement>(".temp-slider")) {
  const emojiEl = slider.parentElement?.querySelector<HTMLElement>(".temp-emoji");
  const postId = slider.dataset.postId;

  const updateEmoji = () => {
    if (emojiEl) emojiEl.textContent = emojiForScore(Number(slider.value));
  };
  updateEmoji();

  slider.addEventListener("input", updateEmoji);
  slider.addEventListener("change", () => {
    if (!postId) return;
    fetch(`/api/posts/${postId}/score`, {
      method: "POST",
      body: new URLSearchParams({ score: slider.value }),
    }).catch(() => {
      // a dropped vote isn't worth interrupting anyone over; it just won't
      // count towards "extremest" sorting until they move the slider again
    });
  });
}
