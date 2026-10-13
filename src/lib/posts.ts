// Hard-deleting a post --- by its own author (src/pages/api/posts/[id]/delete.ts)
// or by the 60-day expiry sweep below --- is the same operation either way,
// so both go through one shared helper rather than two copies that could
// drift on which tables/files actually get cleaned up.
import { unlinkSync } from "node:fs";
import { eq, lt } from "drizzle-orm";
import { logAction } from "./audit";
import { db } from "./db";
import { postImages, postScores, posts } from "./schema";
import { uploadsPath } from "./uploads";

export function deletePostRecord(postId: number): void {
  // Unlink files OUTSIDE the transaction, before any DB delete: if the
  // process dies mid-way, this ordering fails toward a stale DB row pointing
  // at a now-missing file (a broken <img>, cosmetic and self-healing once
  // the row itself is gone) rather than an orphaned file nothing ever cleans
  // up (a silent, permanent disk leak --- nothing in this app scans
  // UPLOADS_DIR for orphans).
  const images = db.select({ path: postImages.path }).from(postImages).where(eq(postImages.postId, postId)).all();
  for (const { path } of images) {
    try {
      unlinkSync(uploadsPath(path));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  // The only hard ordering constraint is "posts last" --- nothing references
  // postImages or postScores, so their relative order doesn't matter.
  // Transactional so a mid-crash can't leave a post whose photos/scores are
  // already gone while the post row itself still stands.
  db.transaction((tx) => {
    tx.delete(postImages).where(eq(postImages.postId, postId)).run();
    tx.delete(postScores).where(eq(postScores.postId, postId)).run();
    tx.delete(posts).where(eq(posts.id, postId)).run();
  });
}

const EXPIRY_SECONDS = 60 * 60 * 24 * 60; // 60 days

// Derived fresh on every call, same spirit as plantHealth(): no cron, no
// counter, nothing to keep in sync. Called once per request from
// index.astro's frontmatter; the common case (nothing's expired) costs one
// cheap, empty-result SELECT.
export function sweepExpiredPosts(): void {
  const since = Math.floor(Date.now() / 1000) - EXPIRY_SECONDS;
  const expired = db
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .where(lt(posts.createdAt, since))
    .all();

  for (const post of expired) {
    deletePostRecord(post.id);
    // personId: null, action distinct from post_delete --- attributing an
    // automatic expiry to the original author would make it read, live in
    // flyctl logs, as that person deleting their own post, which is false.
    logAction(null, "post_expire", `id=${post.id} authorId=${post.authorId}`);
  }
}
