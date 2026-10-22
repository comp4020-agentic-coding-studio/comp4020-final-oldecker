// Shared between wall-vote.ts (your own ballot) and live.ts (anyone else's
// ballot, or the vote resolving, arriving over SSE) --- same split as
// canvas-dom.ts/plant-dom.ts: one place that touches the panel's DOM, so the
// two callers can't drift on what an update looks like.
import { PALETTE } from "../lib/canvas";

export interface WallVoteState {
  id: number;
  status: "open" | "passed" | "failed" | "none";
  yes: number;
  no: number;
  resolvesAt: number;
  memberCount: number;
}

const panel = document.querySelector<HTMLElement>("#wall-vote");
const yesBtn = document.querySelector<HTMLButtonElement>("#wall-vote-yes-btn");
const noBtn = document.querySelector<HTMLButtonElement>("#wall-vote-no-btn");
const note = document.querySelector<HTMLElement>("#wall-vote-note");

let countdownTimer: ReturnType<typeof setInterval> | undefined;

// "2d 4h left", "3h 12m left", "45s left" --- a 3-day window is long enough
// that formatWait()'s seconds-and-minutes-only shape (built for the wall's
// own, much shorter, placement cooldown) would read as an ugly four-digit
// minute count, so this gets its own, coarser formatter.
function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${s}s left`;
}

export function say(text: string, ms = 4000): void {
  if (!note) return;
  note.textContent = text;
  window.setTimeout(() => {
    if (note.textContent === text) note.textContent = "";
  }, ms);
}

function startCountdown(resolvesAt: number): void {
  clearInterval(countdownTimer);
  const tick = () => {
    const timeEl = document.querySelector<HTMLElement>("#wall-vote-time");
    if (!timeEl) return;
    const remaining = resolvesAt - Math.floor(Date.now() / 1000);
    timeEl.textContent = remaining > 0 ? formatRemaining(remaining) : "closing...";
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function renderOpen(state: WallVoteState): void {
  if (!panel) return;
  panel.dataset.voteId = String(state.id);
  panel.dataset.status = "open";
  panel.dataset.resolvesAt = String(state.resolvesAt);
  const summary = document.querySelector<HTMLElement>("#wall-vote-summary");
  if (summary) {
    summary.innerHTML =
      `vote to wipe the wall: <b id="wall-vote-yes">${state.yes}</b> yes · ` +
      `<b id="wall-vote-no">${state.no}</b> no of ${state.memberCount} member${state.memberCount === 1 ? "" : "s"} · ` +
      `<span id="wall-vote-time">closes in a few days</span>`;
  }
  startCountdown(state.resolvesAt);
}

export function renderNone(resultNote?: string): void {
  clearInterval(countdownTimer);
  if (panel) {
    panel.dataset.status = "none";
    const summary = document.querySelector<HTMLElement>("#wall-vote-summary");
    if (summary) summary.textContent = "no vote to wipe the wall is open right now --- voting below starts one";
  }
  yesBtn?.setAttribute("aria-pressed", "false");
  noBtn?.setAttribute("aria-pressed", "false");
  if (resultNote) say(resultNote, 6000);
}

export function applyMyChoice(choice: "yes" | "no" | null): void {
  yesBtn?.setAttribute("aria-pressed", String(choice === "yes"));
  noBtn?.setAttribute("aria-pressed", String(choice === "no"));
  if (panel) panel.dataset.myChoice = choice ?? "";
}

// The one entry point for "the vote's state changed" --- a ballot landing
// (yours or someone else's), or the vote resolving. `mine` is only ever
// passed by your own cast, since the server response is the only place that
// tells you your own current ballot; a live update from someone else never
// touches it.
export function applyWallVoteState(state: WallVoteState, mine?: "yes" | "no" | null): void {
  if (state.status === "open") {
    renderOpen(state);
    if (mine !== undefined) applyMyChoice(mine);
    return;
  }
  if (state.status === "passed") renderNone("the vote passed --- the wall's been wiped, and the old one saved to past walls.");
  else if (state.status === "failed") renderNone("the vote to wipe the wall didn't pass.");
  else renderNone();
}

// The wall was actually cleared: every cell goes back to white, same as a
// fresh wall --- the saved snapshot lives in the gallery now, not on screen.
export function applyWallWiped(): void {
  const white = PALETTE[0]?.hex ?? "#ffffff";
  for (const rect of document.querySelectorAll<SVGRectElement>("#pixel-canvas rect[data-x]")) rect.setAttribute("fill", white);
}

// On load: if the house page rendered an open vote, keep its countdown
// ticking --- the SSR markup already has the numbers, this just starts the
// clock (same "server renders, script animates" split as the pixel cooldown).
if (panel?.dataset.status === "open") {
  const resolvesAt = Number(panel.dataset.resolvesAt ?? "0");
  if (resolvesAt > 0) startCountdown(resolvesAt);
}
