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

export interface PresenceEntry {
  personId: string;
  name: string;
  avatar: string;
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
  | { type: "party_joined"; data: { personId: string; name: string; avatar: string; expiresAt: number } }
  | { type: "party_left"; data: { personId: string } }
  | {
      type: "party_snapshot";
      data: { guests: Array<{ personId: string; name: string; avatar: string; expiresAt: number }> };
    }
  // Someone at the front door (see src/lib/knocks.ts). Only ever broadcast
  // into the knocked-on house's channel, which only its members can
  // subscribe to --- so who's knocking is as private as who's inside.
  // knock_answered covers let in, turned away, walked off (cancelled) and
  // came in by invite instead; every member's door just drops the knock.
  | { type: "knock"; data: KnockEntry }
  | { type: "knock_answered"; data: { id: number; name: string; outcome: string; by: string | null } }
  | { type: "knock_snapshot"; data: { knocks: KnockEntry[] } };

export interface KnockEntry {
  id: number;
  personId: string;
  name: string;
  avatar: string;
  createdAt: number;
}

// The other direction: what a KNOCKER hears while standing at someone's
// door. They aren't a member, so they can't be on that house's channel;
// instead each person has their own channel, which only their own street
// page subscribes to (/api/street-events, keyed on the session cookie).
export type PersonEvent = {
  type: "my_knock";
  data: { id: number; outcome: string; houseSlug: string; houseName: string };
};

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

const personChannel = (personId: string) => `person:${personId}`;

export function tellPerson(personId: string, event: PersonEvent): void {
  bus.emit(personChannel(personId), event);
}

export function subscribePerson(personId: string, onEvent: (event: PersonEvent) => void): () => void {
  bus.on(personChannel(personId), onEvent);
  return () => bus.off(personChannel(personId), onEvent);
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
  return [...(present.get(houseId)?.entries() ?? [])].map(([personId, { name, avatar }]) => ({
    personId,
    name,
    avatar,
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
