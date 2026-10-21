// A single shared-cpu-1x Fly machine is one process, so an in-memory
// pub/sub is enough --- no Redis, no separate broker. Everyone connected to
// this app is connected to this same process. If that ever stops being
// true (more than one machine), this is the thing that needs rethinking.
//
// Everything here is per house: one emitter channel per house id, and one
// presence map per house. An event broadcast into house 3 is only ever
// delivered to streams that subscribed to house 3, and /api/events only
// lets a member subscribe --- so no house's live state leaks into another's
// open tabs (spec/houses.test.ts checks exactly that).
import { EventEmitter } from "node:events";
import { levelsFor } from "./activity";

// `level` is the person's (public) activity level, worked out fresh each
// time a snapshot is taken --- one grouped query for everyone in it, see
// levelsFor() --- so a corridor redraw always shows current badges.
export interface PresenceEntry {
  personId: string;
  name: string;
  avatar: string;
  level: number;
}

export interface PartyGuestEntry {
  personId: string;
  name: string;
  avatar: string;
  expiresAt: number;
  level: number;
}

export type LiveEvent =
  | { type: "watered"; data: { stage: string; waterersThisWeek: number } }
  | { type: "renamed"; data: { name: string } }
  | { type: "presence"; data: { here: PresenceEntry[] } }
  | { type: "pixel"; data: { x: number; y: number; colorIndex: number } }
  | { type: "canvas_renamed"; data: { name: string } }
  // party_joined covers both joining and re-joining-to-refresh (the client
  // upserts by personId either way); party_left covers both a manual leave
  // and an expiry, same as markAbsent not distinguishing a closed tab from
  // navigating away --- see src/lib/party.ts.
  | { type: "party_joined"; data: PartyGuestEntry }
  | { type: "party_left"; data: { personId: string } }
  | { type: "party_snapshot"; data: { guests: PartyGuestEntry[] } }
  // Someone in this house earned points: their badge, ring and leaderboard
  // row change live for everyone with the house open (and their own tab
  // uses it for the progress bar and the level-up toast). Sent by
  // logAction() --- see src/lib/audit.ts.
  | { type: "level"; data: { personId: string; level: number; points: number } };

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open browser tab; no fixed ceiling

const channel = (houseId: number) => `house:${houseId}`;

export function broadcast(houseId: number, event: LiveEvent): void {
  bus.emit(channel(houseId), event);
}

export function subscribe(houseId: number, onEvent: (event: LiveEvent) => void): () => void {
  bus.on(channel(houseId), onEvent);
  return () => bus.off(channel(houseId), onEvent);
}

// houseId -> personId -> {name, avatar, connections}. "connections" rather
// than a plain Set<personId> because one person can have the same house
// open in two tabs --- they shouldn't vanish from its corridor when they
// close just one. Two tabs in two DIFFERENT houses are two separate
// entries, one per house, so that person stands in both corridors.
interface Present {
  name: string;
  avatar: string;
  connections: number;
}
const present = new Map<number, Map<string, Present>>();

export function presenceSnapshot(houseId: number): PresenceEntry[] {
  const entries = [...(present.get(houseId)?.entries() ?? [])];
  const levels = levelsFor(entries.map(([personId]) => personId));
  return entries.map(([personId, { name, avatar }]) => ({
    personId,
    name,
    avatar,
    level: levels.get(personId)?.level ?? 1,
  }));
}

export function presentCount(houseId: number): number {
  return present.get(houseId)?.size ?? 0;
}

function announce(houseId: number): void {
  broadcast(houseId, { type: "presence", data: { here: presenceSnapshot(houseId) } });
}

export function markPresent(houseId: number, personId: string, name: string, avatar: string): void {
  let house = present.get(houseId);
  if (!house) present.set(houseId, (house = new Map()));
  const existing = house.get(personId);
  if (existing) existing.connections++;
  else house.set(personId, { name, avatar, connections: 1 });
  announce(houseId);
}

// A saved avatar edit: the presence entries cached at SSE-connect time would
// otherwise show the old face until that person reconnected --- in every
// house they currently have open.
export function updatePresenceAvatar(personId: string, avatar: string): void {
  for (const [houseId, house] of present) {
    const existing = house.get(personId);
    if (!existing) continue;
    existing.avatar = avatar;
    announce(houseId);
  }
}

export function markAbsent(houseId: number, personId: string): void {
  const house = present.get(houseId);
  const existing = house?.get(personId);
  if (!house || !existing) return;
  existing.connections--;
  if (existing.connections <= 0) house.delete(personId);
  if (house.size === 0) present.delete(houseId);
  announce(houseId);
}
