// The bedroom: only the members of the house who are NOT currently online,
// each tucked into a bunk. Anyone awake is already shown standing in the
// corridor, so showing them here too would just be the same person twice ---
// the bedroom's whole job is to answer "who lives here that I can't already
// see", which only means something for the people who aren't visible
// anywhere else on the page. One function builds its HTML so the server's
// first render and every live re-render in the browser
// (src/scripts/bedroom-dom.ts) are the exact same markup --- the same reason
// party-dom.ts mirrors the party room's SSR. Styled by src/styles/bedroom.css,
// a global stylesheet, since the browser rebuilds these elements and Astro's
// scoped CSS wouldn't reach them.
//
// Beds fill bottom bunk first (nobody wants the top bunk), two sleepers per
// bed, in the order they moved in, so nobody swaps beds when someone else
// comes online or goes offline. An odd number of sleepers leaves the last
// top bunk made but empty. If nobody's offline, there are no beds to draw at
// all, so bedroomHtml() returns a friendly empty state instead.
import { renderAvatarSvg } from "./face";
import { escapeHtml } from "./html";
import { clampLevel, flairHtml } from "./levels";

export interface Sleeper {
  personId: string;
  name: string;
  avatar: string;
  // public activity level, for the same badge and ring the corridor shows
  level?: number;
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

// Shown instead of any beds when every member is currently online --- an
// empty row of beds (or nothing at all) would read as a bug, not as "good
// news, everyone's up".
const EMPTY_STATE = `<p class="bedroom-empty">everyone's awake! no one to see here right now.</p>`;

// Every sleeper here is, by construction, offline --- bedroomHtml() only
// ever calls this with members it has already filtered out of the awake
// set --- so there's no "awake" state left to draw; a bunk in this file is
// always asleep.
function bunkHtml(who: Sleeper | undefined, bunk: "top" | "bottom"): string {
  if (!who) return `<div class="bunk bunk-${bunk} bunk-empty">${BEDDING}</div>`;
  const lv = clampLevel(who.level ?? 1);
  // The head sits inside the level flair (badge + ring), the same wrapper
  // the corridor and party chips use, so level-dom.ts updates it live.
  const head = flairHtml(lv, `<span class="bunk-head"><svg viewBox="0 0 64 64" aria-hidden="true">${renderAvatarSvg(who.avatar)}</svg></span>`);
  return `<div class="bunk bunk-${bunk}" data-person-id="${escapeHtml(who.personId)}" data-name="${escapeHtml(who.name)}" data-state="asleep" title="${escapeHtml(`${who.name} · level ${lv} · asleep`)}">${BEDDING}${head}<span class="bunk-name">${escapeHtml(who.name)}</span><span class="bunk-z" aria-hidden="true">z<i>z</i></span></div>`;
}

// Only the members who are NOT in `awakeIds` get a bunk --- an awake member
// (including you, since you're reading this) is already visible in the
// corridor, so this list is "everyone who lives here that you can't already
// see standing around". If that list is empty, there's nothing to draw a bed
// for, so the room shows the empty state instead of zero beds.
export function bedroomHtml(members: Sleeper[], awakeIds: Iterable<string>, ownId: string): string {
  const awake = new Set(awakeIds);
  awake.add(ownId);
  const sleeping = members.filter((m) => !awake.has(m.personId));
  if (sleeping.length === 0) return EMPTY_STATE;
  const beds: string[] = [];
  for (let i = 0; i < sleeping.length; i += 2) {
    const bottom = sleeping[i];
    const top = sleeping[i + 1];
    beds.push(`<div class="bunk-bed">${FRAME}${bunkHtml(top, "top")}${bunkHtml(bottom, "bottom")}</div>`);
  }
  return beds.join("");
}

// "3 of 5 asleep" for the room's heading, or "everyone's awake" when there's
// no one left to show.
export function bedroomCount(members: Sleeper[], awakeIds: Iterable<string>, ownId: string): string {
  const awake = new Set(awakeIds);
  awake.add(ownId);
  const n = members.filter((m) => !awake.has(m.personId)).length;
  return n === 0 ? "everyone's awake" : `${n} of ${members.length} asleep`;
}
