// A vote to wipe a house's pixel wall. Any member can start one; it passes
// quickly if more than half the house says yes right now, or runs for 3 days
// and passes on a minimum-turnout bar otherwise. Passing never destroys the
// wall --- it's snapshotted into a "past walls" gallery first (wallGallery in
// schema.ts), swept after about 6 months the same derive-at-read way the
// 60-day post expiry works. This file never touches posts, photos, or
// anything outside wall_votes/wall_vote_ballots/pixels/wall_gallery.
//
// Resolution has no cron: a setTimeout is armed when a vote is CREATED,
// firing right at its 3-day deadline, same shape as party.ts's per-join
// expiry timer. But unlike the party room, a 3-day window will usually
// outlive this app's machine between visits (fly.toml scales to zero on
// idle), so that timer is the common-case nicety, not the thing actually
// carrying most votes to resolution --- sweepWallVotes(), called at read time
// from the house page like sweepExpiredPosts()/sweepExpiredPartyGuests(), is
// what a vote almost always actually resolves through in practice. Both
// paths call the exact same resolveVote().
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { logAction } from "./audit";
import { db } from "./db";
import { canvasName } from "./canvas-meta";
import { broadcast, type WallVotePublicEvent } from "./events";
import { type House, memberCounts } from "./houses";
import type { Person } from "./identity";
import { houses, pixels, wallGallery, wallVoteBallots, wallVotes } from "./schema";

export type WallVoteStatus = "open" | "passed" | "failed";
export type WallVoteChoice = "yes" | "no";

const VOTE_WINDOW_SECONDS = 60 * 60 * 24 * 3; // "stays open for 3 days"
// "kept for about 6 months then swept" --- 183 days, no need for calendar
// precision at this app's scale (same honesty as the 60-day post expiry).
const GALLERY_RETENTION_SECONDS = 60 * 60 * 24 * 183;
// A minimum-turnout guard: without it, a single yes vote nobody else answers
// would "pass" the moment the 3-day window ends, which isn't a real decision
// by the house, just an absent one.
const MIN_TURNOUT_YES = 2;

const nowSeconds = () => Math.floor(Date.now() / 1000);

// voteId -> the timer scheduled for ITS resolution. Lost on restart, same as
// every other in-memory timer here --- sweepWallVotes() is what catches that.
const timers = new Map<number, ReturnType<typeof setTimeout>>();

// Same shape as the SSE payload (events.ts's WallVotePublicEvent) --- one
// definition, so a reload and a live update can never disagree on fields.
export type WallVotePublicState = WallVotePublicEvent;

export interface WallVoteState extends WallVotePublicState {
  myChoice: WallVoteChoice | null;
}

function voteTally(voteId: number): { yes: number; no: number } {
  const rows = db
    .select({ choice: wallVoteBallots.choice, n: sql<number>`count(*)` })
    .from(wallVoteBallots)
    .where(eq(wallVoteBallots.voteId, voteId))
    .groupBy(wallVoteBallots.choice)
    .all();
  const tally = { yes: 0, no: 0 };
  for (const row of rows) if (row.choice === "yes" || row.choice === "no") tally[row.choice] = row.n;
  return tally;
}

function ballotOf(voteId: number, personId: string): WallVoteChoice | null {
  const row = db
    .select({ choice: wallVoteBallots.choice })
    .from(wallVoteBallots)
    .where(and(eq(wallVoteBallots.voteId, voteId), eq(wallVoteBallots.personId, personId)))
    .get();
  return row?.choice === "yes" || row?.choice === "no" ? row.choice : null;
}

interface VoteRow {
  id: number;
  status: WallVoteStatus;
  resolvesAt: number;
}

function openVoteOf(houseId: number): VoteRow | undefined {
  return db
    .select({ id: wallVotes.id, status: wallVotes.status, resolvesAt: wallVotes.resolvesAt })
    .from(wallVotes)
    .where(and(eq(wallVotes.houseId, houseId), eq(wallVotes.status, "open")))
    .get() as VoteRow | undefined;
}

function voteById(voteId: number): VoteRow | undefined {
  return db
    .select({ id: wallVotes.id, status: wallVotes.status, resolvesAt: wallVotes.resolvesAt })
    .from(wallVotes)
    .where(eq(wallVotes.id, voteId))
    .get() as VoteRow | undefined;
}

// What a viewer (maybe not voting) sees: the open vote, if there is one, with
// their own ballot --- or null, meaning "no vote right now, anyone can start one".
export function wallVoteState(houseId: number, personId: string): WallVoteState | null {
  const vote = openVoteOf(houseId);
  if (!vote) return null;
  return { ...publicState(houseId, vote), myChoice: ballotOf(vote.id, personId) };
}

function publicState(houseId: number, vote: VoteRow): WallVotePublicState {
  const { yes, no } = voteTally(vote.id);
  const memberCount = memberCounts([houseId]).get(houseId) ?? 0;
  return { id: vote.id, status: vote.status, yes, no, resolvesAt: vote.resolvesAt, memberCount };
}

// Finds the house's open vote, or starts one --- the only guard against two
// concurrent votes is the partial unique index on (house_id) WHERE status =
// 'open' (wall_votes_one_open in schema.ts); insert-and-fall-back-to-lookup
// is the same race-proof shape src/lib/knocks.ts's knock() uses for its own
// "at most one pending" partial index.
function startOrGetVote(house: House): { id: number; resolvesAt: number; created: boolean } {
  const resolvesAt = nowSeconds() + VOTE_WINDOW_SECONDS;
  const row = db
    .insert(wallVotes)
    .values({ houseId: house.id, resolvesAt })
    .onConflictDoNothing()
    .returning({ id: wallVotes.id, resolvesAt: wallVotes.resolvesAt })
    .get();
  if (row) {
    scheduleResolution(house, row.id, row.resolvesAt);
    return { ...row, created: true };
  }
  const existing = openVoteOf(house.id);
  if (!existing) throw new Error("startOrGetVote: insert conflicted but no open vote found");
  return { id: existing.id, resolvesAt: existing.resolvesAt, created: false };
}

function scheduleResolution(house: House, voteId: number, resolvesAt: number): void {
  const existing = timers.get(voteId);
  if (existing) clearTimeout(existing);
  timers.set(
    voteId,
    setTimeout(() => resolveIfDue(house, voteId), Math.max(0, resolvesAt * 1000 - Date.now())),
  );
}

function resolveIfDue(house: House, voteId: number): void {
  timers.delete(voteId);
  const vote = db.select({ status: wallVotes.status }).from(wallVotes).where(eq(wallVotes.id, voteId)).get();
  if (!vote || vote.status !== "open") return; // already resolved (quick pass, or beaten by the sweep)
  const { yes, no } = voteTally(voteId);
  resolveVote(house, voteId, yes > no && yes >= MIN_TURNOUT_YES ? "passed" : "failed", "window");
}

// Closes an open vote with an outcome. Conditional on status = 'open', so a
// vote already closed by the other path (the timer racing the sweep, or a
// quick pass racing the 3-day deadline) is a no-op: no double wipe, no
// double log line, no second broadcast. `reason` is just for the audit
// detail string --- "quick" (more than half said yes right now) vs "window"
// (the 3-day deadline was reached).
function resolveVote(house: House, voteId: number, outcome: "passed" | "failed", reason: "quick" | "window"): void {
  const closed = db
    .update(wallVotes)
    .set({ status: outcome, resolvedAt: nowSeconds() })
    .where(and(eq(wallVotes.id, voteId), eq(wallVotes.status, "open")))
    .returning({ id: wallVotes.id, resolvesAt: wallVotes.resolvesAt })
    .get();
  if (!closed) return;
  const timer = timers.get(voteId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(voteId);
  }

  const { yes, no } = voteTally(voteId);
  if (outcome === "passed") wipeWall(house);
  logAction(null, outcome === "passed" ? "wall_vote_pass" : "wall_vote_fail", `house=${house.slug} vote=${voteId} yes=${yes} no=${no} reason=${reason}`);
  broadcast(house.id, { type: "wall_vote_update", data: publicState(house.id, { id: voteId, status: outcome, resolvesAt: closed.resolvesAt }) });
}

// The wall itself is never destroyed: its current pixels (and the wall's own
// name at the time) move into wall_gallery, in one transaction with clearing
// the live pixels table, so a mid-crash can't leave the snapshot taken but
// the wall un-cleared (or the reverse). Nothing here reads or writes posts,
// post_images, or anything else --- this is the one function that ever wipes
// a wall, and it only ever touches `pixels` and `wall_gallery`.
function wipeWall(house: House): void {
  const name = canvasName(house.id);
  const painted = db
    .select({ x: pixels.x, y: pixels.y, colorIndex: pixels.colorIndex })
    .from(pixels)
    .where(eq(pixels.houseId, house.id))
    .all();
  db.transaction((tx) => {
    tx.insert(wallGallery).values({ houseId: house.id, name, pixels: JSON.stringify(painted) }).run();
    tx.delete(pixels).where(eq(pixels.houseId, house.id)).run();
  });
  broadcast(house.id, { type: "wall_wiped", data: {} });
}

// The one entry point a route calls: cast (or change) your ballot, starting
// the house's vote if none is open. Quick-pass is checked against the
// house's CURRENT member count every time a ballot lands, not a count frozen
// when the vote started --- someone joining mid-vote changes what "more than
// half" means.
export function castWallVote(house: House, person: Person, choice: WallVoteChoice): WallVoteState {
  const { id, resolvesAt, created } = startOrGetVote(house);
  db.insert(wallVoteBallots)
    .values({ voteId: id, personId: person.id, choice })
    .onConflictDoUpdate({
      target: [wallVoteBallots.voteId, wallVoteBallots.personId],
      set: { choice, votedAt: sql`(unixepoch())` },
    })
    .run();
  logAction(person, "wall_vote_cast", `house=${house.slug} vote=${id} choice=${choice}${created ? " new" : ""}`);

  const { yes } = voteTally(id);
  const memberCount = memberCounts([house.id]).get(house.id) ?? 0;
  // "strictly more than half" --- memberCount=1 means a single yes passes it,
  // on purpose: that's still every current member saying yes.
  if (yes > memberCount / 2) resolveVote(house, id, "passed", "quick");
  else broadcast(house.id, { type: "wall_vote_update", data: publicState(house.id, { id, status: "open", resolvesAt }) });

  // Re-read rather than assume: resolveVote() above may just have closed
  // (and possibly wiped) this very vote.
  const current = voteById(id) ?? { id, status: "open" as WallVoteStatus, resolvesAt };
  return { ...publicState(house.id, current), myChoice: ballotOf(id, person.id) };
}

// Called once per request, same "derive fresh, no cron" shape as
// sweepExpiredPosts()/sweepExpiredPartyGuests() --- the restart-safe fallback
// for the in-flight setTimeout above. Sweeps every house, not just the one
// being viewed, same reasoning as the party room's own sweep: a house
// nobody's opened in 3 days still needs its vote to actually close.
export function sweepWallVotes(): void {
  const now = nowSeconds();
  const due = db
    .select({
      id: wallVotes.id,
      houseId: wallVotes.houseId,
      slug: houses.slug,
      name: houses.name,
      inviteCode: houses.inviteCode,
    })
    .from(wallVotes)
    .innerJoin(houses, eq(houses.id, wallVotes.houseId))
    .where(and(eq(wallVotes.status, "open"), lt(wallVotes.resolvesAt, now)))
    .all();
  for (const row of due) {
    const house: House = { id: row.houseId, slug: row.slug, name: row.name, inviteCode: row.inviteCode };
    const { yes, no } = voteTally(row.id);
    resolveVote(house, row.id, yes > no && yes >= MIN_TURNOUT_YES ? "passed" : "failed", "window");
  }
}

export interface GalleryItem {
  id: number;
  name: string;
  pixels: Array<{ x: number; y: number; colorIndex: number }>;
  wipedAt: number;
}

// Most recent wipe first --- the "past walls" gallery.
export function galleryFor(houseId: number): GalleryItem[] {
  return db
    .select({ id: wallGallery.id, name: wallGallery.name, pixels: wallGallery.pixels, wipedAt: wallGallery.wipedAt })
    .from(wallGallery)
    .where(eq(wallGallery.houseId, houseId))
    .orderBy(desc(wallGallery.wipedAt), desc(wallGallery.id))
    .all()
    .map((row) => ({ ...row, pixels: JSON.parse(row.pixels) as GalleryItem["pixels"] }));
}

// Swept the same derive-at-read way as everything else here: called once per
// request (the house page, and the gallery page itself), costing one cheap,
// usually-empty SELECT. Never deletes a post or a photo --- this table only
// ever holds old pixel snapshots.
export function sweepWallGallery(): void {
  const since = nowSeconds() - GALLERY_RETENTION_SECONDS;
  const expired = db
    .select({ id: wallGallery.id, houseId: wallGallery.houseId })
    .from(wallGallery)
    .where(lt(wallGallery.wipedAt, since))
    .all();
  for (const row of expired) {
    db.delete(wallGallery).where(eq(wallGallery.id, row.id)).run();
    logAction(null, "wall_gallery_sweep", `house=${row.houseId} galleryId=${row.id}`);
  }
}
