import { eq, sql } from "drizzle-orm";
import type { APIRoute } from "astro";
import { logAction } from "../../../../lib/audit";
import { db } from "../../../../lib/db";
import { houseAccess } from "../../../../lib/houses";
import { postScores, posts } from "../../../../lib/schema";
import { SCORE_MAX, SCORE_MIN } from "../../../../lib/temperature";

export const prerender = false;

// Form-encoded, not JSON: Astro's CSRF origin check only applies to
// form-like content types (see PROCESS.md), and this mutates the same way
// every other action in this app does, so it should be covered by the same
// check, not quietly exempt from it.
export const POST: APIRoute = async ({ params, request, cookies, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const postId = Number(params.id);
  if (!Number.isInteger(postId)) return new Response("invalid post", { status: 400 });

  // The post has to be in the house you named (and are a member of) ---
  // otherwise this would be a way to vote on, and read the scores of, a
  // post in a house you can't see.
  const post = db.select({ houseId: posts.houseId }).from(posts).where(eq(posts.id, postId)).get();
  if (!post || post.houseId !== house.id) return new Response("post not found", { status: 404 });

  const raw = form?.get("score");
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

  logAction(person, "post_score", `house=${house.slug} postId=${postId} score=${score}`);

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
