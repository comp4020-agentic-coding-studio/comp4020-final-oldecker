// Activity levels on the house page, kept live: every badge and ring for a
// person (corridor, party room, leaderboard --- and any other chip that
// wraps its avatar in .lvl-flair inside an element with data-person-id),
// the leaderboard's order, and, for your own level, the progress bar under
// the wall and the level-up toast.
//
// Changes arrive two ways: a "level" SSE event (live.ts) when anyone in the
// house earns points, and your own pixel placement's response
// (pixel-canvas.ts) --- both call applyLevel(). Presence and party payloads
// also carry each person's level, so chips rebuilt by party-dom.ts are
// already right.
import { ACTION_HINTS, ACTION_WEIGHTS, clampLevel, formatCadence, LEVELS, levelLine, levelProgress, progressLine } from "../lib/levels";
import { updateCachedLevel } from "./party-dom";

const progressEl = document.querySelector<HTMLElement>("#level-progress");
const ownPersonId = progressEl?.dataset.personId ?? "";
const leaderboardEl = document.querySelector<HTMLOListElement>("#leaderboard-list");

// The level you last saw yourself at, kept in this browser so a level-up
// that happened elsewhere (another tab, your phone, overnight) still gets
// its moment the next time you open the page. localStorage can be missing
// or throw (private windows, blocked storage); then the page just doesn't
// celebrate across reloads, and still does for level-ups seen live.
const storageKey = `board:last-level:${ownPersonId}`;
function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? null : clampLevel(raw);
  } catch {
    return null;
  }
}
function writeSeen(level: number): void {
  try {
    localStorage.setItem(storageKey, String(level));
  } catch {
    // storage unavailable: fine, see above
  }
}

let myLevel = clampLevel(progressEl?.dataset.level);
let seenLevel = myLevel;

function cooldownFor(level: number): number {
  return LEVELS[clampLevel(level) - 1][1];
}

// --- badges and rings, for anyone ---------------------------------------
function updateFlairs(personId: string, level: number): void {
  const holders = document.querySelectorAll<HTMLElement>(`[data-person-id="${CSS.escape(personId)}"]`);
  for (const holder of holders) {
    const name = holder.dataset.name;
    if (holder.classList.contains("party-guest") && name && holder.title) holder.title = `${name} · level ${level}`;
    if (holder.dataset.level !== undefined) holder.dataset.level = String(level);
    for (const flair of holder.querySelectorAll<HTMLElement>(".lvl-flair")) {
      const before = clampLevel(flair.dataset.level);
      if (before === level) continue;
      flair.dataset.level = String(level);
      const badge = flair.querySelector<HTMLElement>(".lvl-badge");
      if (badge) {
        badge.textContent = String(level);
        badge.setAttribute("aria-label", `level ${level}`);
      }
      if (level > before) bump(flair);
    }
  }
}

function bump(el: HTMLElement): void {
  el.classList.remove("lvl-bump");
  void el.offsetWidth; // restart the animation if it's mid-way
  el.classList.add("lvl-bump");
  el.addEventListener("animationend", () => el.classList.remove("lvl-bump"), { once: true });
}

// --- the leaderboard -----------------------------------------------------
function updateLeaderboard(personId: string, level: number, points: number): void {
  if (!leaderboardEl) return;
  const row = leaderboardEl.querySelector<HTMLElement>(`.lb-row[data-person-id="${CSS.escape(personId)}"]`);
  // Someone who joined the house after this page loaded isn't listed until
  // a reload; nothing to update for them here.
  if (!row) return;
  row.dataset.points = String(points);
  const levelText = row.querySelector(".lb-level");
  if (levelText) levelText.textContent = `level ${level}`;
  const pointsText = row.querySelector(".lb-points");
  if (pointsText) pointsText.textContent = `${points} pts`;

  // Re-sort: points, then name --- the same order the server uses.
  const rows = [...leaderboardEl.querySelectorAll<HTMLElement>(".lb-row")];
  rows.sort(
    (a, b) =>
      Number(b.dataset.points) - Number(a.dataset.points) || (a.dataset.name ?? "").localeCompare(b.dataset.name ?? ""),
  );
  let rank = 0;
  let prevPoints: number | null = null;
  for (const [i, r] of rows.entries()) {
    const p = Number(r.dataset.points);
    if (p !== prevPoints) rank = i + 1;
    prevPoints = p;
    const rankEl = r.querySelector(".lb-rank");
    if (rankEl) rankEl.textContent = String(rank);
    leaderboardEl.appendChild(r); // moves it; appending in order = sorted
  }
}

// --- your own progress ------------------------------------------------------
function renderProgress(level: number, points: number): void {
  if (!progressEl) return;
  const p = levelProgress(points);
  progressEl.dataset.level = String(level);
  progressEl.dataset.points = String(points);
  const title = progressEl.querySelector("#level-progress-title");
  if (title) title.textContent = p.nextLevel === null ? `level ${level} · the top` : `level ${level}`;
  const text = progressEl.querySelector("#level-progress-text");
  if (text) text.textContent = progressLine(points);
  const bar = progressEl.querySelector<HTMLElement>(".lvl-bar");
  bar?.setAttribute("aria-valuenow", String(Math.round(p.fraction * 100)));
  const fill = progressEl.querySelector<HTMLElement>(".lvl-bar-fill");
  if (fill) fill.style.width = `${(p.fraction * 100).toFixed(1)}%`;
  const levelLabel = document.querySelector<HTMLElement>("#canvas-level");
  if (levelLabel) {
    levelLabel.textContent = levelLine(level, cooldownFor(level));
    levelLabel.dataset.cooldownSeconds = String(cooldownFor(level));
  }
}

// Which actions already scored today: asked of the server after you earn
// points, since only it knows (a repeat today is worth nothing).
async function refreshHints(): Promise<void> {
  const list = document.querySelector<HTMLElement>("#level-hints");
  if (!list) return;
  try {
    const res = await fetch("/api/level", { cache: "no-store" });
    if (!res.ok) return;
    const { earnedToday } = (await res.json()) as { earnedToday: string[] };
    const done = new Set(earnedToday);
    for (const li of list.querySelectorAll<HTMLElement>("li[data-action]")) {
      const action = li.dataset.action ?? "";
      const hint = ACTION_HINTS.find((h) => h.action === action);
      if (!hint) continue;
      const isDone = done.has(action);
      li.classList.toggle("done", isDone);
      li.innerHTML = `${hint.label} <b>+${ACTION_WEIGHTS[action] ?? 0}</b>${isDone ? " ✓ today" : ""}`;
    }
  } catch {
    // offline for a moment: the hints just stay as they were
  }
}

function celebrate(level: number): void {
  for (const el of document.querySelectorAll(".lvl-toast")) el.remove();
  const toast = document.createElement("div");
  toast.className = "lvl-toast";
  toast.dataset.level = String(level);
  toast.setAttribute("role", "status");
  const sub =
    level >= LEVELS.length
      ? `the top level: a pixel every ${formatCadence(cooldownFor(level))}`
      : `you can place a pixel every ${formatCadence(cooldownFor(level))} now`;
  // Only numbers and fixed strings go in here, no user text.
  toast.innerHTML = `<span class="lvl-toast-medal" aria-hidden="true">${level}</span><span class="lvl-toast-text"><strong>level up! you're level ${level}</strong><span>${sub}</span></span>`;
  const colours = ["var(--lvl-2)", "var(--lvl-4)", "var(--lvl-5)", "var(--lvl-5b)", "var(--lvl-3)"];
  for (let i = 0; i < 14; i++) {
    const bit = document.createElement("span");
    bit.className = "lvl-confetti";
    bit.setAttribute("aria-hidden", "true");
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const dist = 50 + Math.random() * 60;
    bit.style.setProperty("--i", String(i));
    bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    bit.style.setProperty("--rot", `${Math.round((Math.random() - 0.5) * 720)}deg`);
    bit.style.background = colours[i % colours.length];
    toast.appendChild(bit);
  }
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

function updateMine(level: number, points: number): void {
  const previous = myLevel;
  myLevel = level;
  renderProgress(level, points);
  if (level > seenLevel) celebrate(level);
  seenLevel = level;
  writeSeen(level);
  if (level !== previous)
    document.dispatchEvent(
      new CustomEvent("board:my-level", { detail: { level, cooldownSeconds: cooldownFor(level), previous } }),
    );
  void refreshHints();
}

// The one entry point: someone's level or points changed.
export function applyLevel(personId: string, rawLevel: unknown, rawPoints: unknown): void {
  const level = clampLevel(rawLevel);
  const points = Math.max(0, Math.round(Number(rawPoints) || 0));
  updateCachedLevel(personId, level);
  updateFlairs(personId, level);
  updateLeaderboard(personId, level, points);
  if (personId === ownPersonId) updateMine(level, points);
}

// On load: if you're higher than the level this browser last saw you at,
// you levelled up while away --- celebrate now. A first visit (nothing
// stored) just records the level quietly; so does going down a level as
// old days fall out of the window.
if (ownPersonId) {
  const stored = readSeen();
  if (stored !== null && myLevel > stored) celebrate(myLevel);
  writeSeen(myLevel);
}
