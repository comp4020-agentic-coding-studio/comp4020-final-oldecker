// The live channel: presence (who's here) and plant waterings, pushed over
// Server-Sent Events --- one-directional, server-to-client, which is all
// this app needs (every write still goes through its own POST route).
// Posts and votes are deliberately NOT on this channel yet; see PROCESS.md
// for why that's a decision and not an oversight.
import type { APIRoute } from "astro";
import { currentPerson } from "../../lib/identity";
import { markAbsent, markPresent, presenceSnapshot, subscribe, type LiveEvent } from "../../lib/events";

export const prerender = false;

const HEARTBEAT_MS = 20_000; // keeps Fly's proxy (and any browser/OS idle timeout) from closing a quiet connection

export const GET: APIRoute = ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: LiveEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`));
      };

      // Register (and broadcast to everyone ALREADY subscribed) before
      // subscribing this stream --- otherwise this client would miss its
      // own join's presence broadcast, having not subscribed yet when it
      // fired. It gets its own up-to-date snapshot explicitly, right after.
      markPresent(person.id, person.name, person.avatar);
      unsubscribe = subscribe(send);
      send({ type: "presence", data: { here: presenceSnapshot() } });

      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), HEARTBEAT_MS);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe?.();
      markAbsent(person.id);
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
