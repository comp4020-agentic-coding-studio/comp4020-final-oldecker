import { eq } from "drizzle-orm";
import type { APIRoute } from "astro";
import { logAction } from "../../../../lib/audit";
import { db } from "../../../../lib/db";
import { currentPerson } from "../../../../lib/identity";
import { deletePostRecord } from "../../../../lib/posts";
import { posts } from "../../../../lib/schema";

export const prerender = false;

// Bodyless POST, same as water.ts: no body means no content-type header,
// which routes into Astro's origin-check middleware's unconditional
// same-origin branch (see PROCESS.md's crit-10 ADR) --- covered without
// needing a form-encoded body for a route that has nothing to say beyond
// "delete this one".
export const POST: APIRoute = async ({ params, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const postId = Number(params.id);
  if (!Number.isInteger(postId)) return new Response("invalid post", { status: 400 });

  const post = db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).get();
  if (!post) return new Response("post not found", { status: 404 });

  // The server-checked access control decision crit 10 asks for: anyone can
  // read any post, only the author can remove it --- see PROCESS.md.
  if (post.authorId !== person.id) return new Response("not your post", { status: 403 });

  deletePostRecord(postId);
  logAction(person, "post_delete", `id=${postId}`);

  // No SSE broadcast: posts are reload-only, same decision crit 9's ADR
  // already made for creating one --- see PROCESS.md for the one visible
  // consequence of combining that with a hard delete.
  return new Response(null, { status: 204 });
};
