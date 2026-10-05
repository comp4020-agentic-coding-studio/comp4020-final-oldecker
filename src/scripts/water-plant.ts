// The watering-can tap: no visible "action button" styling, just the can
// itself as the affordance, with a short animation standing in for feedback
// rather than a toast or a counter ticking up.
const can = document.querySelector<HTMLButtonElement>("#water-can");
const plant = document.querySelector<HTMLElement>("#plant");
const stageLabel = document.querySelector<HTMLElement>("#plant-stage");

can?.addEventListener("click", async () => {
  if (can.disabled) return;
  can.disabled = true;
  can.classList.add("pouring");

  try {
    const res = await fetch("/api/water", { method: "POST" });
    if (res.ok) {
      const health = (await res.json()) as { stage: string; waterersThisWeek: number };
      plant?.setAttribute("data-stage", health.stage);
      if (stageLabel)
        stageLabel.textContent = `${health.waterersThisWeek} of ${can.dataset.threshold ?? "?"} this week`;
      plant?.classList.add("just-watered");
      setTimeout(() => plant?.classList.remove("just-watered"), 900);
    }
  } finally {
    setTimeout(() => {
      can.classList.remove("pouring");
      can.disabled = false;
    }, 700);
  }
});
