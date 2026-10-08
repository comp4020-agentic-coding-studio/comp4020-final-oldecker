// A single shared-cpu-1x Fly machine is one process, so an in-memory
// pub/sub is enough --- no Redis, no separate broker. Everyone connected to
// this app is connected to this same process. If that ever stops being
// true (more than one machine), this is the thing that needs rethinking.
import { EventEmitter } from "node:events";

export type LiveEvent =
  | { type: "watered"; data: { stage: string; waterersThisWeek: number } }
  | { type: "presence"; data: { here: Array<{ name: string; avatar: string }> } };

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open browser tab; no fixed ceiling

export function broadcast(event: LiveEvent): void {
  bus.emit("event", event);
}

export function subscribe(onEvent: (event: LiveEvent) => void): () => void {
  bus.on("event", onEvent);
  return () => bus.off("event", onEvent);
}

// personId -> {name, avatar, connections}. "connections" rather than a
// plain Set<personId> because one person can have the board open in two
// tabs --- they shouldn't vanish from presence when they close just one.
interface Present {
  name: string;
  avatar: string;
  connections: number;
}
const present = new Map<string, Present>();

export function presenceSnapshot(): Array<{ name: string; avatar: string }> {
  return [...present.values()].map(({ name, avatar }) => ({ name, avatar }));
}

export function markPresent(personId: string, name: string, avatar: string): void {
  const existing = present.get(personId);
  if (existing) existing.connections++;
  else present.set(personId, { name, avatar, connections: 1 });
  broadcast({ type: "presence", data: { here: presenceSnapshot() } });
}

export function markAbsent(personId: string): void {
  const existing = present.get(personId);
  if (!existing) return;
  existing.connections--;
  if (existing.connections <= 0) present.delete(personId);
  broadcast({ type: "presence", data: { here: presenceSnapshot() } });
}
