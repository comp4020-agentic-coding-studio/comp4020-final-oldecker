// Shared between party-drag.ts (your own join/leave) and live.ts (someone
// else's, arriving over SSE) --- both need the exact same DOM update to the
// room's guest list and the corridor, so it lives in one place rather than
// two copies that could drift. Same split as plant-dom.ts/canvas-dom.ts.
//
// The DOM itself is the source of truth for who's in the room (one
// .party-room-avatar per guest, keyed by data-person-id). The one piece of
// JS state is `present`, the last presence snapshot: the corridor shows
// "present in this house, minus whoever's in the party room", so a room
// change has to redraw the corridor too, and it needs the latest presence
// list to do that.
import { renderAvatarSvg } from "../lib/face";
import { escapeHtml } from "../lib/html";

export { escapeHtml };

export interface PartyGuest {
  personId: string;
  name: string;
  avatar: string;
  expiresAt: number;
}

export interface PresenceEntry {
  personId: string;
  name: string;
  avatar: string;
}

const roomEl = document.querySelector<HTMLElement>("#party-room-guests");
const emptyLabel = document.querySelector<HTMLElement>("#party-room-empty");
const yourChip = document.querySelector<HTMLElement>("#party-you");
const corridorEl = document.querySelector<HTMLElement>("#corridor-guests");
const corridorEmpty = document.querySelector<HTMLElement>("#corridor-empty");

function chipHtml(name: string, avatar: string): string {
  return `<span class="party-avatar-circle"><svg viewBox="0 0 64 64" aria-hidden="true">${renderAvatarSvg(avatar)}</svg></span><span class="party-guest-name">${escapeHtml(name)}</span>`;
}

function guestEl(guest: PartyGuest, isOwn: boolean): HTMLElement {
  const el = document.createElement("span");
  el.className = "party-guest party-room-avatar";
  el.dataset.personId = guest.personId;
  if (isOwn) el.dataset.own = "true";
  el.title = guest.name;
  // Matches the house page's SSR markup exactly, so a person who joins live
  // over SSE looks identical to one rendered on the page's first load.
  el.innerHTML = chipHtml(guest.name, guest.avatar);
  return el;
}

// Seeded from the SSR'd corridor so a room change before the first SSE
// presence event still redraws the corridor correctly.
let present: PresenceEntry[] = [...(corridorEl?.querySelectorAll<HTMLElement>(".corridor-guest") ?? [])].map(
  (el) => ({ personId: el.dataset.personId ?? "", name: el.dataset.name ?? "", avatar: el.dataset.avatar ?? "" }),
);

function inRoom(personId: string): boolean {
  return !!roomEl?.querySelector(`.party-room-avatar[data-person-id="${CSS.escape(personId)}"]`);
}

function renderCorridor(ownPersonId: string): void {
  if (!corridorEl) return;
  const standing = present.filter((p) => p.personId !== ownPersonId && !inRoom(p.personId));
  corridorEl.innerHTML = standing
    .map(
      (p) =>
        `<span class="party-guest corridor-guest" data-person-id="${escapeHtml(p.personId)}" title="${escapeHtml(p.name)}">${chipHtml(p.name, p.avatar)}</span>`,
    )
    .join("");
  if (corridorEmpty) corridorEmpty.hidden = standing.length > 0 || !yourChip?.hidden;
}

function refresh(ownPersonId: string): void {
  if (emptyLabel) emptyLabel.hidden = !!roomEl?.querySelector(".party-room-avatar");
  // Your own corridor chip hides once you're in the room --- the way back
  // out is dragging your in-room avatar, not a second copy outside it too.
  if (yourChip) yourChip.hidden = inRoom(ownPersonId);
  renderCorridor(ownPersonId);
}

export function applyPresence(here: PresenceEntry[], ownPersonId: string): void {
  present = here;
  refresh(ownPersonId);
}

export function applyPartyJoin(guest: PartyGuest, ownPersonId: string): void {
  if (!roomEl) return;
  roomEl.querySelector(`[data-person-id="${CSS.escape(guest.personId)}"]`)?.remove();
  roomEl.appendChild(guestEl(guest, guest.personId === ownPersonId));
  refresh(ownPersonId);
}

export function applyPartyLeave(personId: string, ownPersonId: string): void {
  roomEl?.querySelector(`[data-person-id="${CSS.escape(personId)}"]`)?.remove();
  refresh(ownPersonId);
}

// The full-roster replace used once, right after a fresh SSE connection's
// party_snapshot --- rebuilding the whole list rather than diffing it.
export function renderPartyRoom(guests: PartyGuest[], ownPersonId: string): void {
  if (!roomEl) return;
  roomEl.innerHTML = "";
  for (const guest of guests) roomEl.appendChild(guestEl(guest, guest.personId === ownPersonId));
  refresh(ownPersonId);
}
