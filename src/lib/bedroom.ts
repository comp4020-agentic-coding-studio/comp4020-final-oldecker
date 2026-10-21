// The bedroom: every member of the house, online or not, each tucked into a
// bunk. One function builds its HTML so the server's first render and every
// live re-render in the browser (src/scripts/bedroom-dom.ts) are the exact
// same markup --- the same reason party-dom.ts mirrors the party room's SSR.
// Styled by src/styles/bedroom.css, a global stylesheet, since the browser
// rebuilds these elements and Astro's scoped CSS wouldn't reach them.
//
// Beds fill bottom bunk first (nobody wants the top bunk), two people per
// bed, in the order they moved in, so nobody swaps beds when someone else
// comes online. An odd number leaves the last top bunk made but empty.
import { renderAvatarSvg } from "./face";
import { escapeHtml } from "./html";

export interface Sleeper {
  personId: string;
  name: string;
  avatar: string;
}

// The bed itself, in a 128x150 box (1 unit = --u in bedroom.css): two posts,
// two mattresses on their side boards, a top guard rail and a ladder. The
// pillows, blankets and people are the two .bunk slots laid over it.
const FRAME = `<svg class="bunk-frame" viewBox="0 0 128 150" aria-hidden="true">
<rect x="113" y="34" width="3" height="116" rx="1.5" class="bed-frame-dark"/>
<rect x="124" y="34" width="3" height="116" rx="1.5" class="bed-frame-dark"/>
<path d="M113 52h14M113 72h14M113 92h14M113 112h14M113 132h14" class="bed-rung"/>
<rect x="2" y="8" width="7" height="142" rx="2" class="bed-frame"/>
<rect x="103" y="8" width="7" height="142" rx="2" class="bed-frame"/>
<circle cx="5.5" cy="7" r="4.5" class="bed-frame"/>
<circle cx="106.5" cy="7" r="4.5" class="bed-frame"/>
<rect x="44" y="27" width="59" height="5" rx="2.5" class="bed-frame"/>
<rect x="9" y="44" width="94" height="10" rx="2" class="bed-sheet"/>
<rect x="4" y="53" width="104" height="9" rx="2.5" class="bed-frame"/>
<rect x="9" y="112" width="94" height="10" rx="2" class="bed-sheet"/>
<rect x="4" y="121" width="104" height="9" rx="2.5" class="bed-frame"/>
<path d="M4 57.5h104M4 125.5h104" class="bed-grain"/>
</svg>`;

// Pillow and blanket for one bunk, in its 94x34 slot. The blanket's colour
// comes from the bed's --blanket (cycled per bed in CSS).
const BEDDING = `<svg class="bunk-bedding" viewBox="0 0 94 34" aria-hidden="true">
<rect x="2" y="15" width="27" height="11" rx="5.5" class="bed-pillow"/>
<rect x="25" y="14" width="69" height="20" rx="6" class="bed-blanket"/>
<rect x="25" y="14" width="11" height="20" rx="5" class="bed-blanket-fold"/>
<path d="M27 31.5h65" class="bed-blanket-hem"/>
</svg>`;

function bunkHtml(who: Sleeper | undefined, level: "top" | "bottom", awake: Set<string>, ownId: string): string {
  if (!who) return `<div class="bunk bunk-${level} bunk-empty">${BEDDING}</div>`;
  const isOwn = who.personId === ownId;
  const isAwake = isOwn || awake.has(who.personId);
  const label = isOwn ? "you" : who.name;
  const state = isAwake ? "awake" : "asleep";
  return `<div class="bunk bunk-${level}" data-person-id="${escapeHtml(who.personId)}" data-name="${escapeHtml(who.name)}" data-state="${state}"${isOwn ? ' data-own="true"' : ""} title="${escapeHtml(`${who.name} · ${isAwake ? "awake, in the house now" : "asleep"}`)}">${BEDDING}<span class="bunk-head"><svg viewBox="0 0 64 64" aria-hidden="true">${renderAvatarSvg(who.avatar)}</svg></span><span class="bunk-name">${escapeHtml(label)}</span>${isAwake ? "" : '<span class="bunk-z" aria-hidden="true">z<i>z</i></span>'}</div>`;
}

export function bedroomHtml(members: Sleeper[], awakeIds: Iterable<string>, ownId: string): string {
  const awake = new Set(awakeIds);
  const beds: string[] = [];
  for (let i = 0; i < Math.max(members.length, 1); i += 2) {
    const bottom = members[i];
    const top = members[i + 1];
    beds.push(
      `<div class="bunk-bed">${FRAME}${bunkHtml(top, "top", awake, ownId)}${bunkHtml(bottom, "bottom", awake, ownId)}</div>`,
    );
  }
  return beds.join("");
}

// "3 of 5 awake" for the room's heading.
export function bedroomCount(members: Sleeper[], awakeIds: Iterable<string>, ownId: string): string {
  const awake = new Set(awakeIds);
  awake.add(ownId);
  const n = members.filter((m) => awake.has(m.personId)).length;
  return `${n} of ${members.length} awake`;
}
