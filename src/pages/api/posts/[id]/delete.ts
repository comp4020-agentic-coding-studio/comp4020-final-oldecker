import { eq } from "drizzle-orm";
import type { APIRoute } from "astro";
import { logAction } from "../../../../lib/audit";
import { db } from "../../../../lib/db";
import { houseAccess } from "../../../../lib/houses";
import { deletePostRecord } from "../../../../lib/posts";
import { posts } from "../../../../lib/schema";

export const prerender = false;

// Bodyless POST to /api/posts/<id>/delete?house=<slug>: no body means no
// content-type header, which routes into Astro's origin-check middleware's
// unconditional same-origin branch (see PROCESS.md's crit-10 ADR).
export const POST: APIRoute = async ({ params, cookies, url }) => {
  const access = houseAccess(cookies, url);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const postId = Number(params.id);
  if (!Number.isInteger(postId)) return new Response("invalid post", { status: 400 });

  const post = db
    .select({ authorId: posts.authorId, houseId: posts.houseId })
    .from(posts)
    .where(eq(posts.id, postId))
    .get();
  // A post in some other house is "not found" from here: naming a house
  // you ARE in doesn't reach into one you aren't.
  if (!post || post.houseId !== house.id) return new Response("post not found", { status: 404 });

  // The server-checked access control decision crit 10 asks for: anyone in
  // the house can read any of its posts, only the author can remove one ---
  // see PROCESS.md.
  if (post.authorId !== person.id) return new Response("not your post", { status: 403 });

  deletePostRecord(postId);
  logAction(person, "post_delete", `house=${house.slug} id=${postId}`);

  // No SSE broadcast: posts are reload-only, same decision crit 9's ADR
  // already made for creating one --- see PROCESS.md for the one visible
  // consequence of combining that with a hard delete.
  return new Response(null, { status: 204 });
};
