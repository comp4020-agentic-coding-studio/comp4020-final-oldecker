// Shared between party-drag.ts (your own join/leave) and live.ts (someone
// else's, arriving over SSE) --- both need the exact same DOM update to the
// room's guest list, so it lives in one place rather than two copies that
// could drift. Same split as plant-dom.ts/canvas-dom.ts.
//
// No separate JS array tracking "who's in the room": the DOM itself is the
// source of truth (one .party-room-avatar element per guest, keyed by
// data-person-id), the same way applyPlantName reads dataset.previous
// straight off the element rather than a module-level variable. Two
// independent callers (this file's own drag handler, and live.ts) each
// keeping their own copy of "the current guest list" would drift the
// moment one updated without the other knowing.
import { avatarById } from "../lib/avatars";

export interface PartyGuest {
  personId: string;
  name: string;
  avatar: string;
  expiresAt: number;
}

const roomEl = document.querySelector<HTMLElement>("#party-room-guests");
const emptyLabel = document.querySelector<HTMLElement>("#party-room-empty");
const yourChip = document.querySelector<HTMLElement>("#party-you");

function guestEl(guest: PartyGuest, isOwn: boolean): HTMLElement {
  const avatar = avatarById(guest.avatar);
  const el = document.createElement("span");
  el.className = "party-guest party-room-avatar";
  el.dataset.personId = guest.personId;
  if (isOwn) el.dataset.own = "true";
  el.title = guest.name;
  // Matches index.astro's SSR markup exactly: an avatar circle plus a name
  // label underneath, so a person who joins live over SSE looks identical
  // to one rendered on the page's first load.
  el.innerHTML = `<span class="party-avatar-circle"><svg viewBox="0 0 64 64" aria-hidden="true">${avatar?.svg ?? ""}</svg></span><span class="party-guest-name">${escapeHtml(guest.name)}</span>`;
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function refreshEmptyAndOwnState(ownPersonId: string): void {
  if (emptyLabel) emptyLabel.hidden = !!roomEl?.querySelector(".party-room-avatar");
  // Hide your own "drag me in" chip once you're already in the room --- the
  // way back out is dragging your in-room avatar, not a second copy sitting
  // outside it too.
  if (yourChip) yourChip.hidden = !!roomEl?.querySelector(`.party-room-avatar[data-person-id="${ownPersonId}"]`);
}

export function applyPartyJoin(guest: PartyGuest, ownPersonId: string): void {
  if (!roomEl) return;
  roomEl.querySelector(`[data-person-id="${guest.personId}"]`)?.remove();
  roomEl.appendChild(guestEl(guest, guest.personId === ownPersonId));
  refreshEmptyAndOwnState(ownPersonId);
}

export function applyPartyLeave(personId: string, ownPersonId: string): void {
  roomEl?.querySelector(`[data-person-id="${personId}"]`)?.remove();
  refreshEmptyAndOwnState(ownPersonId);
}

// The full-roster replace used once, right after a fresh SSE connection's
// party_snapshot --- same role presence's renderPresence plays for the
// initial presence event, rebuilding the whole list rather than diffing it.
export function renderPartyRoom(guests: PartyGuest[], ownPersonId: string): void {
  if (!roomEl) return;
  roomEl.innerHTML = "";
  for (const guest of guests) roomEl.appendChild(guestEl(guest, guest.personId === ownPersonId));
  refreshEmptyAndOwnState(ownPersonId);
}
