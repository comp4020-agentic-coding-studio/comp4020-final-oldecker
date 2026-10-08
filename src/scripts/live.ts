// The live channel: presence and the plant update without a reload, for
// every open tab --- posts and votes still wait for one (see PROCESS.md for
// why that line is drawn where it is). One EventSource per tab; the server
// side of this is src/pages/api/events.ts.
import { avatarById } from "../lib/avatars";

interface PresenceEvent {
  here: Array<{ name: string; avatar: string }>;
}
interface WateredEvent {
  stage: string;
  waterersThisWeek: number;
}

const presenceEl = document.querySelector<HTMLElement>("#presence");
const plantEl = document.querySelector<HTMLElement>("#plant");
const plantStageEl = document.querySelector<HTMLElement>("#plant-stage");
const waterCan = document.querySelector<HTMLButtonElement>("#water-can");

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

function applyWatered(health: WateredEvent): void {
  plantEl?.setAttribute("data-stage", health.stage);
  if (plantStageEl)
    plantStageEl.textContent = `${health.waterersThisWeek} of ${waterCan?.dataset.threshold ?? "?"} this week`;
  plantEl?.classList.add("just-watered");
  setTimeout(() => plantEl?.classList.remove("just-watered"), 900);
}

const source = new EventSource("/api/events");

source.addEventListener("presence", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as PresenceEvent;
  renderPresence(data.here);
});

source.addEventListener("watered", (e) => {
  const data = JSON.parse((e as MessageEvent).data) as WateredEvent;
  applyWatered(data);
});

// A dropped connection (a laptop sleeping, a flaky network) shouldn't need
// a manual reload to recover --- EventSource retries on its own, but only
// once the browser decides the connection is actually dead; nothing extra
// to do here beyond letting it.
