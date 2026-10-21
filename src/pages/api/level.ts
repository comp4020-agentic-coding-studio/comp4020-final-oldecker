import type { APIRoute } from "astro";
import { activityLevel, earnedToday } from "../../lib/activity";
import { currentPerson } from "../../lib/identity";

export const prerender = false;

// GET /api/level: your own level, points, cooldown, and which actions have
// already scored today. Read-only and always about the cookie's owner, so
// there is nothing to name or spoof. The house page calls it after you earn
// points (a "level" event about you arrives over SSE) to refresh the
// progress bar's "already done today" hints without a reload.
export const GET: APIRoute = ({ cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });
  const mine = activityLevel(person.id);
  return new Response(JSON.stringify({ ...mine, earnedToday: earnedToday(person.id) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
