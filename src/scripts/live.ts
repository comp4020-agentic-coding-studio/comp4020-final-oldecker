// The live channel: presence and the plant update without a reload, for
// every open tab --- posts and votes still wait for one (see PROCESS.md for
// why that line is drawn where it is). One EventSource per tab; the server
// side of this is src/pages/api/events.ts.
import type { PlantStage } from "../lib/plant-art";
import { avatarById } from "../lib/avatars";
import { applyPlantHealth, applyPlantName } from "./plant-dom";
import { pourIntoPlant } from "./water-pour";

interface PresenceEvent {
  here: Array<{ name: string; avatar: string }>;
}
interface WateredEvent {
  stage: PlantStage;
  waterersThisWeek: number;
}

const presenceEl = document.querySelector<HTMLElement>("#presence");

function renderPresence(here: PresenceEvent["here"]): void {
  if (!presenceEl) return;
  if (here.length === 0) {
    presenceEl.innerHTML = '<span class="presence-empty">no one else here right now</span>';
    return;
  }
  presenceEl.innerHTML = here
    .map((p) => {
      const avatar = avatarById(p.avatar);
      const safeName = p.name.replace(/"/g, "&quot;");
      return `<span class="presence-avatar" title="${safeName}"><svg viewBox="0 0 64 64" aria-hidden="true">${avatar?.svg ?? ""}</svg></span>`;
    })
    .join("");
}

const source = new EventSource("/api/events");

source.addEventListener("presence", (e) => {
  renderPresence((JSON.parse((e as MessageEvent).data) as PresenceEvent).here);
});

source.addEventListener("watered", (e) => {
  // Someone else watered it --- play the same travelling-can animation on
  // your screen too, not just update the plant's numbers silently.
  void pourIntoPlant();
  applyPlantHealth(JSON.parse((e as MessageEvent).data) as WateredEvent);
});

source.addEventListener("renamed", (e) => {
  applyPlantName((JSON.parse((e as MessageEvent).data) as { name: string }).name);
});

// A dropped connection (a laptop sleeping, a flaky network) shouldn't need
// a manual reload to recover --- EventSource retries on its own, but only
// once the browser decides the connection is actually dead; nothing extra
// to do here beyond letting it.
