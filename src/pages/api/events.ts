// The live channel for one house: who's in its corridor (presence), its
// plant, its wall, and its party room, pushed over Server-Sent Events ---
// one-directional, server-to-client, which is all this app needs (every
// write still goes through its own POST route). Posts and votes are
// deliberately NOT on this channel yet; see PROCESS.md for why that's a
// decision and not an oversight.
//
// GET /api/events?house=<slug>. Membership is checked before the stream
// opens; a non-member gets a 403 and never subscribes, so they can't learn
// who's in a house, or watch its plant, by holding a stream open.
import type { APIRoute } from "astro";
import {
  markAbsent,
  markPresent,
  presenceSnapshot,
  subscribe,
  subscribeHousePerson,
  type LiveEvent,
} from "../../lib/events";
import { houseAccess } from "../../lib/houses";
import { pendingKnocks } from "../../lib/knocks";
import { partyRoomSnapshot } from "../../lib/party";

export const prerender = false;

const HEARTBEAT_MS = 20_000; // keeps Fly's proxy (and any browser/OS idle timeout) from closing a quiet connection

export const GET: APIRoute = ({ cookies, url }) => {
  const access = houseAccess(cookies, url);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`));
      };

      // Register (and broadcast to everyone ALREADY subscribed to this
      // house) before subscribing this stream --- otherwise this client
      // would miss its own join's presence broadcast, having not subscribed
      // yet when it fired. It gets its own up-to-date snapshot explicitly,
      // right after.
      markPresent(house.id, person.id, person.name, person.avatar);
      const offHouse = subscribe(house.id, send);
      // ...and this person's own private channel in this house (a heart
      // someone sends them --- src/lib/lieb.ts), which no one else's stream
      // is subscribed to.
      const offPersonal = subscribeHousePerson(house.id, person.id, send);
      unsubscribe = () => {
        offHouse();
        offPersonal();
      };
      send({ type: "presence", data: { here: presenceSnapshot(house.id) } });
      // Same reasoning as the presence snapshot above --- a fresh
      // connection shouldn't wait on the next party_joined/party_left
      // broadcast to find out who's already in the room.
      send({ type: "party_snapshot", data: { guests: partyRoomSnapshot(house.id) } });
      // ...and who's at the front door, so a reconnect after a dropped
      // connection doesn't leave a knock showing that's since been answered.
      send({ type: "knock_snapshot", data: { knocks: pendingKnocks(house.id) } });

      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), HEARTBEAT_MS);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe?.();
      markAbsent(house.id, person.id);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
};
