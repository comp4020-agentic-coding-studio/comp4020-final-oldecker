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
import { source } from "./house-events";
import { applyLevel } from "./level-dom";
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
import { applyWallVoteState, applyWallWiped, renderNone, type WallVoteState } from "./wall-vote-dom";
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

// Someone in this house earned points (maybe you, from another tab or
// action): their badge, ring and leaderboard row, and if it's you, your
// progress bar and maybe a level-up toast. See level-dom.ts.
source.addEventListener("level", (e) => {
  const { personId, level, points } = JSON.parse((e as MessageEvent).data) as {
    personId: string;
    level: number;
    points: number;
  };
  applyLevel(personId, level, points);
});

source.addEventListener("party_snapshot", (e) => {
  renderPartyRoom((JSON.parse((e as MessageEvent).data) as { guests: PartyGuest[] }).guests, ownPersonId);
});

// A ballot landed (yours from another tab, or anyone else's), or the vote
// resolved --- never carries YOUR OWN current choice (only your own cast's
// response knows that), so wall-vote.ts is the only caller that passes one.
source.addEventListener("wall_vote_update", (e) => {
  applyWallVoteState(JSON.parse((e as MessageEvent).data) as WallVoteState);
});

// A fresh (or re-)connection's view of the vote: open with its tally, or
// nothing open at all --- same self-healing-on-reconnect shape as
// party_snapshot/knock_snapshot above.
source.addEventListener("wall_vote_snapshot", (e) => {
  const state = JSON.parse((e as MessageEvent).data) as WallVoteState;
  if (state.status === "open") applyWallVoteState(state);
  else renderNone();
});

// The wall was actually cleared: every cell goes back to white for everyone
// watching, live --- the old state is already safe in the gallery.
source.addEventListener("wall_wiped", () => {
  applyWallWiped();
});

// A dropped connection (a laptop sleeping, a flaky network) shouldn't need
// a manual reload to recover --- EventSource retries on its own, but only
// once the browser decides the connection is actually dead; nothing extra
// to do here beyond letting it.
