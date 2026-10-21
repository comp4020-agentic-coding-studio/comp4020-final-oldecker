// The front door's doormat (src/components/FrontDoorKnocks.astro), kept live:
// a knock arriving adds the knocker, a knock answered by ANY member (or
// walked away from) takes them off, on every member's open page. The "let
// in" / "turn away" buttons are plain forms that work without JS; this
// upgrades them to fetch() so answering doesn't reload the page. The server
// decides whether the answer counts (see src/lib/knock-routes.ts) --- this
// only ever reflects what it said.
import { renderAvatarSvg } from "../lib/face";
import { source } from "./house-events";
import { escapeHtml } from "./party-dom";

interface Knock {
  id: number;
  personId: string;
  name: string;
  avatar: string;
  createdAt: number;
}

const section = document.querySelector<HTMLElement>("#front-door");
const list = document.querySelector<HTMLUListElement>("#fd-list");
const note = document.querySelector<HTMLElement>("#fd-note");
const door = document.querySelector<SVGElement>("#fd-door");
const houseSlug = section?.dataset.house ?? "";

function sync(): void {
  if (!section || !list) return;
  const any = list.querySelector(".fd-knocker:not(.leaving)") !== null;
  // keep the panel up while a note is showing, so "let in Sam" doesn't
  // vanish the instant it's said
  section.hidden = !any && !note?.textContent;
}

function say(text: string): void {
  if (!note) return;
  note.textContent = text;
  sync();
  window.setTimeout(() => {
    if (note.textContent === text) note.textContent = "";
    sync();
  }, 4000);
}

function rattle(): void {
  if (!door) return;
  door.classList.remove("knocking");
  // restart the animation even if it's mid-play
  void door.getBoundingClientRect();
  door.classList.add("knocking");
}

function formHtml(action: string, id: number, cls: string, label: string): string {
  return `<form class="fd-answer" method="post" action="${action}"><input type="hidden" name="house" value="${escapeHtml(houseSlug)}" /><input type="hidden" name="knock" value="${id}" /><button type="submit" class="${cls}">${label}</button></form>`;
}

function knockerEl(k: Knock): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "fd-knocker";
  li.dataset.knockId = String(k.id);
  // same markup as the server-rendered doormat; the name is escaped, the
  // avatar SVG comes from our own renderer (it validates the config)
  li.innerHTML =
    `<span class="fd-avatar"><svg viewBox="0 0 64 64" aria-hidden="true">${renderAvatarSvg(k.avatar)}</svg></span>` +
    `<span class="fd-name">${escapeHtml(k.name)}</span>` +
    formHtml("/api/houses/knocks/let-in", k.id, "fd-let-in", "let in") +
    formHtml("/api/houses/knocks/turn-away", k.id, "fd-turn-away", "turn away");
  return li;
}

function addKnock(k: Knock, ring: boolean): void {
  if (!list || list.querySelector(`[data-knock-id="${k.id}"]`)) return;
  list.append(knockerEl(k));
  sync();
  if (ring) rattle();
}

function removeKnock(id: number): void {
  list?.querySelector(`[data-knock-id="${id}"]`)?.remove();
  sync();
}

source.addEventListener("knock", (e) => {
  addKnock(JSON.parse((e as MessageEvent).data) as Knock, true);
});

source.addEventListener("knock_answered", (e) => {
  const { id, name, outcome, by } = JSON.parse((e as MessageEvent).data) as {
    id: number;
    name: string;
    outcome: string;
    by: string | null;
  };
  const wasShowing = !!list?.querySelector(`[data-knock-id="${id}"]`);
  removeKnock(id);
  if (!wasShowing) return;
  if (outcome === "let_in") say(by ? `${by} let ${name} in.` : `${name} came in with an invite link.`);
  else if (outcome === "turned_away") say(by ? `${by} turned ${name} away.` : `${name} was turned away.`);
  else if (outcome === "cancelled") say(`${name} stopped waiting.`);
});

// A fresh (or re-) connection's view of the door: replace what's showing,
// so nothing answered while the connection was down lingers.
source.addEventListener("knock_snapshot", (e) => {
  if (!list) return;
  const { knocks } = JSON.parse((e as MessageEvent).data) as { knocks: Knock[] };
  const want = new Set(knocks.map((k) => String(k.id)));
  for (const li of list.querySelectorAll<HTMLElement>(".fd-knocker")) {
    if (!want.has(li.dataset.knockId ?? "")) li.remove();
  }
  for (const k of knocks) addKnock(k, false);
  sync();
});

list?.addEventListener("submit", async (event) => {
  const form = event.target as HTMLFormElement;
  if (!form.classList.contains("fd-answer")) return;
  event.preventDefault();
  const li = form.closest<HTMLElement>(".fd-knocker");
  const name = li?.querySelector(".fd-name")?.textContent ?? "them";
  const letIn = form.action.endsWith("/let-in");
  li?.classList.add("leaving");
  try {
    const res = await fetch(form.action, {
      method: "POST",
      headers: { accept: "application/json" },
      body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { changed, outcome } = (await res.json()) as { changed: boolean; outcome: string };
    li?.remove();
    if (changed) say(letIn ? `You let ${name} in.` : `You turned ${name} away.`);
    else say(outcome === "cancelled" ? `${name} had already stopped waiting.` : `Someone already answered ${name}.`);
  } catch {
    li?.classList.remove("leaving");
    say("That didn't go through. Try again?");
  }
  sync();
});
