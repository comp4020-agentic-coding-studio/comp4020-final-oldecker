// Uploaded photos live on the /data volume, not in public/ (that's bundled
// at build time and wouldn't see anything uploaded after a deploy), so
// they're served dynamically here instead.
//
// Since houses, a photo is part of its house: it's only served to a
// logged-in member of the house its post is in. Anyone else --- logged out,
// or in other houses only --- gets the same 404 as a file that doesn't
// exist, so a copied image URL doesn't carry a house's photos outside it.
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../../lib/db";
import { isMember } from "../../lib/houses";
import { currentPerson } from "../../lib/identity";
import { postImages, posts } from "../../lib/schema";
import { uploadsPath } from "../../lib/uploads";

export const prerender = false;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const notFound = () => new Response("not found", { status: 404 });

export const GET: APIRoute = ({ params, cookies }) => {
  const name = params.path ?? "";
  // Reject anything that isn't a bare filename this app wrote itself --- no
  // traversal out of the uploads dir.
  if (!name || name.includes("/") || name.includes("..")) return notFound();

  const person = currentPerson(cookies);
  if (!person) return notFound();
  const owner = db
    .select({ houseId: posts.houseId })
    .from(postImages)
    .innerJoin(posts, eq(posts.id, postImages.postId))
    .where(eq(postImages.path, name))
    .get();
  if (!owner || !isMember(owner.houseId, person.id)) return notFound();

  const filePath = uploadsPath(name);
  const type = CONTENT_TYPES[path.extname(name).toLowerCase()];
  if (!type || !existsSync(filePath)) return notFound();

  return new Response(readFileSync(filePath), {
    // private: the answer depends on who's asking now, so no shared cache
    // may keep it. The file itself never changes (uuid names), so the
    // browser's own cache can hold it for good.
    headers: { "content-type": type, "cache-control": "private, max-age=31536000, immutable" },
  });
};
