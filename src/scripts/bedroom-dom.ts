// The bedroom, kept live. No channel of its own: it listens to the same
// per-house `presence` events the corridor does (who's awake = who has the
// house open), plus `member_joined` for a new bunk (both wired in live.ts).
// Rebuilt through the same bedroomHtml() the server rendered it with, so a
// live update looks exactly like a fresh load.
import { bedroomCount, bedroomHtml, type Sleeper } from "../lib/bedroom";
import type { PresenceEntry } from "./party-dom";

const bedsEl = document.querySelector<HTMLElement>("#bedroom-beds");
const countEl = document.querySelector<HTMLElement>("#bedroom-count");
const dataEl = document.querySelector<HTMLScriptElement>("#bedroom-data");

const initial = dataEl ? (JSON.parse(dataEl.textContent ?? "{}") as { members?: Sleeper[]; awake?: string[] }) : {};
const members: Sleeper[] = initial.members ?? [];
let awake = new Set<string>(initial.awake ?? []);
const ownId = document.querySelector<HTMLElement>("#party-you")?.dataset.personId ?? "";

function render(): void {
  if (!bedsEl) return;
  bedsEl.innerHTML = bedroomHtml(members, awake, ownId);
  if (countEl) countEl.textContent = bedroomCount(members, awake, ownId);
}

export function applyBedroomPresence(here: PresenceEntry[]): void {
  const next = new Set(here.map((p) => p.personId));
  // A presence entry also carries the latest face, so an avatar edit shows
  // up in the bunk too.
  let changed = next.size !== awake.size || [...next].some((id) => !awake.has(id));
  for (const p of here) {
    const m = members.find((m) => m.personId === p.personId);
    if (m && m.avatar !== p.avatar) {
      m.avatar = p.avatar;
      changed = true;
    }
  }
  awake = next;
  if (changed) render();
}

export function applyMemberJoined(member: Sleeper): void {
  if (members.some((m) => m.personId === member.personId)) return;
  members.push(member);
  render();
}
