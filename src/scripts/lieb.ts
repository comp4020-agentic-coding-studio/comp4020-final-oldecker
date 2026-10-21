// "ich hab dich lieb": double-click (or double-tap) anyone else's avatar ---
// in the corridor, the party room or the bedroom --- to send them a heart.
// The server (src/pages/api/lieb.ts) holds every rule: both of you are
// members, it isn't you, once a day per pair. This file is the gesture, the
// feedback, and showing the hearts sent to YOU (live over your own private
// SSE channel, or waiting from while you were away).
//
// Why pointer events and not `dblclick`: mobile browsers don't reliably fire
// dblclick for a double-tap, and pointerdown is one code path for both. It
// never fights the drag gesture (drag.ts) because the two never share an
// avatar: only YOUR avatar is draggable, and only OTHER people's take a
// double-tap. Your own is skipped below on purpose.
import { escapeHtml } from "../lib/html";
import { houseUrl } from "./house-context";

export interface LiebItem {
  id: number;
  fromPersonId: string;
  fromName: string;
  createdAt: number;
}

const TARGETS = ".corridor-guest, .party-room-avatar, .bunk[data-person-id]";
const DOUBLE_MS = 380;
const DOUBLE_PX = 24;
const ownId = document.querySelector<HTMLElement>("#party-you")?.dataset.personId ?? "";

// --- toasts ------------------------------------------------------------------

let toastsEl: HTMLElement | null = null;
function toasts(): HTMLElement {
  if (!toastsEl) {
    toastsEl = document.createElement("div");
    toastsEl.className = "lieb-toasts";
    toastsEl.setAttribute("role", "status");
    toastsEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastsEl);
  }
  return toastsEl;
}

// `html` is built by the callers below, and every name in it is escaped there.
function toast(html: string, { quiet = false, ms = 5000 } = {}): void {
  const el = document.createElement("div");
  el.className = `lieb-toast${quiet ? " quiet" : ""}`;
  el.innerHTML = `<span class="lieb-toast-text">${html}</span><button type="button" class="lieb-toast-close" aria-label="dismiss">×</button>`;
  const dismiss = () => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 320);
  };
  el.querySelector("button")?.addEventListener("click", dismiss);
  setTimeout(dismiss, ms);
  toasts().appendChild(el);
}

function ago(createdAt: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - createdAt);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// --- hearts ------------------------------------------------------------------

function burst(target: Element): void {
  const r = target.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return;
  const el = document.createElement("div");
  el.className = "lieb-burst";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const parts = [`<span class="big" style="--size:2rem">❤</span>`];
  for (let i = 0; i < 6; i++) {
    const dx = Math.round((i - 2.5) * 11 + (Math.random() * 8 - 4));
    const size = (0.8 + Math.random() * 0.6).toFixed(2);
    parts.push(`<span style="--dx:${dx}px;--size:${size}rem;--delay:${(0.08 * i + 0.1).toFixed(2)}s">❤</span>`);
  }
  el.innerHTML = parts.join("");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// Every place your own face is on screen right now: the corridor chip (or
// your in-room avatar if you're in the party room) and your bunk.
function ownAvatars(): Element[] {
  const sel = `#party-you:not([hidden]) .party-avatar-circle, .party-room-avatar[data-own] .party-avatar-circle, .bunk[data-own] .bunk-head`;
  return [...document.querySelectorAll(sel)];
}

// --- receiving -----------------------------------------------------------------

function showReceived(item: LiebItem, live: boolean): void {
  const when = live ? "" : ` <span class="lieb-toast-when">· ${ago(item.createdAt)}</span>`;
  toast(
    `<strong>${escapeHtml(item.fromName)}</strong> hat dich lieb <span class="lieb-toast-heart">❤</span>${when}`,
    { ms: live ? 6000 : 9000 },
  );
  for (const el of ownAvatars()) burst(el);
}

// A live heart that arrived while this tab was in the background waits until
// it's actually looked at --- and is only then marked seen on the server, so
// a tab that's closed unread still shows it next visit.
const waiting: LiebItem[] = [];

function markSeen(id: number): void {
  void fetch(houseUrl("/api/lieb/seen"), { method: "POST", body: new URLSearchParams({ id: String(id) }) });
}

export function receiveLieb(item: LiebItem): void {
  if (document.visibilityState === "visible") {
    showReceived(item, true);
    markSeen(item.id);
  } else {
    waiting.push(item);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  for (const item of waiting.splice(0)) {
    showReceived(item, false);
    markSeen(item.id);
  }
});

// The ones that came while you were away: rendered into the page by the
// server (and already marked seen there, since this page is showing them).
// A few at once is lovely; a whole week's worth gets summed up.
const inboxEl = document.querySelector<HTMLScriptElement>("#lieb-inbox");
const inbox = inboxEl ? (JSON.parse(inboxEl.textContent ?? "[]") as LiebItem[]) : [];
if (inbox.length > 0) {
  // a beat after load, so it reads as something arriving
  setTimeout(() => {
    const shown = inbox.length > 4 ? inbox.slice(-3) : inbox;
    shown.forEach((item, i) => setTimeout(() => showReceived(item, false), i * 450));
    const rest = inbox.length - shown.length;
    if (rest > 0) {
      const names = [...new Set(inbox.slice(0, rest).map((i) => i.fromName))];
      toast(
        `and ${rest} more <span class="lieb-toast-heart">❤</span> from ${escapeHtml(names.slice(0, 3).join(", "))}${names.length > 3 ? " and others" : ""}`,
        { ms: 9000 },
      );
    }
  }, 600);
}

// --- sending -------------------------------------------------------------------

const sending = new Set<string>();

async function send(targetEl: HTMLElement, personId: string): Promise<void> {
  if (sending.has(personId)) return;
  sending.add(personId);
  const avatar = targetEl.querySelector(".party-avatar-circle, .bunk-head") ?? targetEl;
  try {
    const res = await fetch(houseUrl("/api/lieb"), { method: "POST", body: new URLSearchParams({ to: personId }) });
    const body = (await res.json().catch(() => ({}))) as { toName?: string; reason?: string };
    const name = escapeHtml(body.toName ?? targetEl.dataset.name ?? targetEl.title ?? "them");
    if (res.ok) {
      burst(avatar);
      toast(`<span class="lieb-toast-heart">❤</span> ich hab dich lieb → <strong>${name}</strong>`, { quiet: true });
    } else if (body.reason === "already-today") {
      toast(`you already told <strong>${name}</strong> today <span class="lieb-toast-heart">❤</span>`, { quiet: true });
    } else {
      toast("that didn't send, try again in a moment", { quiet: true });
    }
  } catch {
    toast("that didn't send, try again in a moment", { quiet: true });
  } finally {
    sending.delete(personId);
  }
}

// Double-tap detection, delegated on the document so it covers avatars that
// are rebuilt live (corridor, party room, bedroom) without re-wiring.
let last: { personId: string; t: number; x: number; y: number } | null = null;

document.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const el = (e.target as Element).closest<HTMLElement>(TARGETS);
  const personId = el?.dataset.personId;
  if (!el || !personId) {
    last = null;
    return;
  }
  const now = performance.now();
  const isDouble =
    last &&
    last.personId === personId &&
    now - last.t < DOUBLE_MS &&
    Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_PX;
  if (!isDouble) {
    last = { personId, t: now, x: e.clientX, y: e.clientY };
    return;
  }
  last = null;
  // Your own avatar is for dragging, not hearts --- and a double-press on it
  // never gets here as a drop either (drag.ts treats it as two taps).
  if (personId === ownId || el.dataset.own !== undefined) {
    if (el.matches(".bunk")) toast("that's you! double-tap someone else", { quiet: true, ms: 2500 });
    return;
  }
  e.preventDefault();
  void send(el, personId);
});

// stops a desktop double-click from selecting the name under it
document.addEventListener("dblclick", (e) => {
  if ((e.target as Element).closest(TARGETS)) window.getSelection()?.removeAllRanges();
});
