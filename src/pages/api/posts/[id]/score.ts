import { eq, sql } from "drizzle-orm";
import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { currentPerson } from "../../../../lib/identity";
import { postScores } from "../../../../lib/schema";
import { SCORE_MAX, SCORE_MIN } from "../../../../lib/temperature";

export const prerender = false;

// Form-encoded, not JSON: Astro's CSRF origin check only applies to
// form-like content types (see PROCESS.md), and this mutates the same way
// every other action in this app does, so it should be covered by the same
// check, not quietly exempt from it.
export const POST: APIRoute = async ({ params, request, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const postId = Number(params.id);
  if (!Number.isInteger(postId)) return new Response("invalid post", { status: 400 });

  const form = await request.formData();
  const raw = form.get("score");
  const score = typeof raw === "string" ? Math.round(Number(raw)) : NaN;
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX)
    return new Response(`score must be an integer between ${SCORE_MIN} and ${SCORE_MAX}`, {
      status: 400,
    });

  db.insert(postScores)
    .values({ postId, personId: person.id, score })
    .onConflictDoUpdate({
      target: [postScores.postId, postScores.personId],
      set: { score, updatedAt: sql`(unixepoch())` },
    })
    .run();

  // The full set, not just this one vote --- the client redraws its own
  // strip plot from this so your own rating shows up immediately, same
  // layout a reload would produce, without a second round trip.
  const scores = db
    .select({ score: postScores.score })
    .from(postScores)
    .where(eq(postScores.postId, postId))
    .all()
    .map((row) => row.score);

  return new Response(JSON.stringify({ scores }), { headers: { "content-type": "application/json" } });
};
