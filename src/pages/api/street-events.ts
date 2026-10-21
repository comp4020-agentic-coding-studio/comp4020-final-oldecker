// The street page's live channel: news about YOUR knocks. While you wait at
// a house's door you aren't a member, so you can't hold that house's
// /api/events stream; this one is yours alone instead, keyed on the session
// cookie (there's no person id in the request to swap for someone else's).
// It carries exactly one kind of event --- my_knock, when a door you knocked
// on is answered --- and nothing about any house beyond its name and slug,
// which you already typed to knock.
import type { APIRoute } from "astro";
import { subscribePerson, type PersonEvent } from "../../lib/events";
import { currentPerson } from "../../lib/identity";

export const prerender = false;

const HEARTBEAT_MS = 20_000;

export const GET: APIRoute = ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: PersonEvent) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`));
      };
      unsubscribe = subscribePerson(person.id, send);
      // an opening comment so the client knows the stream is up
      controller.enqueue(encoder.encode(": listening\n\n"));
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), HEARTBEAT_MS);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe?.();
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
