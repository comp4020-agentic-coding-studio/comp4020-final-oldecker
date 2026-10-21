// Your own avatar's moves inside a house: corridor -> party room (join),
// party room -> anywhere else (leave), and corridor or room -> the street
// door (go back out to the street page). Someone ELSE joining/leaving
// arrives through live.ts instead (same split as the plant and the canvas).
// The gesture itself lives in drag.ts; this file only says what each drop
// zone means.
import { dragFrom, type DropZone } from "./drag";
import { houseUrl } from "./house-context";
import { applyPartyJoin, applyPartyLeave } from "./party-dom";

const roomZoneEl = document.querySelector<HTMLElement>("#party-room-dropzone");
const roomGuestsEl = document.querySelector<HTMLElement>("#party-room-guests");
const streetEl = document.querySelector<HTMLElement>("#street-door");
const youChip = document.querySelector<HTMLElement>("#party-you");
const ownPersonId = youChip?.dataset.personId ?? "";
const ownName = youChip?.dataset.name ?? "";
const ownAvatar = youChip?.dataset.avatar ?? "";

async function joinRoom(): Promise<void> {
  const res = await fetch(houseUrl("/api/party/join"), { method: "POST" });
  if (!res.ok) throw new Error("join failed");
  const { expiresAt } = (await res.json()) as { expiresAt: number };
  applyPartyJoin({ personId: ownPersonId, name: ownName, avatar: ownAvatar, expiresAt }, ownPersonId);
}

async function leaveRoom(): Promise<void> {
  const res = await fetch(houseUrl("/api/party/leave"), { method: "POST" });
  if (!res.ok) throw new Error("leave failed");
  applyPartyLeave(ownPersonId, ownPersonId);
}

// Out the front door. Just a navigation: the street is a page, not a shared
// space, so nobody else sees you there --- leaving this tab closes its SSE
// stream, which is what takes you out of the corridor for everyone else.
// A party-room slot is deliberately NOT cleared on the way out: it means
// "free to hang out for a couple of hours", not "has this tab open".
const toStreet = (): void => {
  streetEl?.classList.add("leaving");
  window.location.href = "/houses";
};

// The street door is listed first: zones are hit-tested in order.
const streetZone: DropZone | null = streetEl ? { el: streetEl, onDrop: toStreet } : null;

youChip?.addEventListener("pointerdown", (e) => {
  const zones: DropZone[] = [];
  if (streetZone) zones.push(streetZone);
  if (roomZoneEl) zones.push({ el: roomZoneEl, onDrop: joinRoom });
  dragFrom(youChip, e, { zones });
});

// Event-delegated on the room container, not one listener per avatar: the
// guest list's elements come and go as people join/leave, and delegation
// means a newly-added avatar is draggable without any extra wiring. Dropping
// your in-room avatar anywhere outside the room leaves it (as it always
// has); dropping it on the street door goes out to the street.
roomGuestsEl?.addEventListener("pointerdown", (e) => {
  const avatarEl = (e.target as HTMLElement).closest<HTMLElement>(".party-room-avatar[data-own]");
  if (!avatarEl) return;
  const zones: DropZone[] = [];
  if (streetZone) zones.push(streetZone);
  // Dropped back inside the room: nothing happens (still in it).
  if (roomZoneEl) zones.push({ el: roomZoneEl, onDrop: () => {} });
  dragFrom(avatarEl, e, { zones, onMiss: leaveRoom });
});

// Keyboard/tap fallback: the street door is also a real link, so it works
// without dragging at all.
