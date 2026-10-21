// The live channel for THIS house: who's in the corridor, the plant, the
// pixel canvas, and the party room update without a reload, for every open
// tab --- posts and votes still wait for one (see PROCESS.md for why that
// line is drawn where it is). One EventSource per tab, subscribed to this
// house only; the server side is src/pages/api/events.ts, which checks
// membership before sending anything.
import type { PlantStage } from "../lib/plant-art";
import { PALETTE } from "../lib/canvas";
import type { Sleeper } from "../lib/bedroom";
import { applyBedroomPresence, applyMemberJoined } from "./bedroom-dom";
import { applyCanvasName } from "./canvas-dom";
import { houseUrl } from "./house-context";
import {
  applyPartyJoin,
  applyPartyLeave,
  applyPresence,
  renderPartyRoom,
  type PartyGuest,
  type PresenceEntry,
} from "./party-dom";
import { receiveLieb, type LiebItem } from "./lieb";
import { applyPlantHealth, applyPlantName } from "./plant-dom";
import { pourIntoPlant } from "./water-pour";

interface WateredEvent {
  stage: PlantStage;
  waterersThisWeek: number;
}
interface PixelEvent {
  x: number;
  y: number;
  colorIndex: number;
}

const ownPersonId = document.querySelector<HTMLElement>("#party-you")?.dataset.personId ?? "";

const source = new EventSource(houseUrl("/api/events"));

source.addEventListener("presence", (e) => {
  const { here } = JSON.parse((e as MessageEvent).data) as { here: PresenceEntry[] };
  applyPresence(here, ownPersonId);
  // the bedroom reads the same event: present = awake, everyone else asleep
  applyBedroomPresence(here);
});

source.addEventListener("member_joined", (e) => {
  applyMemberJoined(JSON.parse((e as MessageEvent).data) as Sleeper);
});

// Only ever arrives on THIS person's own stream (events.ts's sendToPerson):
// a heart someone just sent you.
source.addEventListener("lieb", (e) => {
  receiveLieb(JSON.parse((e as MessageEvent).data) as LiebItem);
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

source.addEventListener("pixel", (e) => {
  const { x, y, colorIndex } = JSON.parse((e as MessageEvent).data) as PixelEvent;
  const rect = document.querySelector<SVGRectElement>(`#pixel-canvas rect[data-x="${x}"][data-y="${y}"]`);
  rect?.setAttribute("fill", PALETTE[colorIndex]?.hex ?? "#ffffff");
});

source.addEventListener("canvas_renamed", (e) => {
  applyCanvasName((JSON.parse((e as MessageEvent).data) as { name: string }).name);
});

source.addEventListener("party_joined", (e) => {
  applyPartyJoin(JSON.parse((e as MessageEvent).data) as PartyGuest, ownPersonId);
});

source.addEventListener("party_left", (e) => {
  applyPartyLeave((JSON.parse((e as MessageEvent).data) as { personId: string }).personId, ownPersonId);
});

source.addEventListener("party_snapshot", (e) => {
  renderPartyRoom((JSON.parse((e as MessageEvent).data) as { guests: PartyGuest[] }).guests, ownPersonId);
});

// A dropped connection (a laptop sleeping, a flaky network) shouldn't need
// a manual reload to recover --- EventSource retries on its own, but only
// once the browser decides the connection is actually dead; nothing extra
// to do here beyond letting it.
