// Uploaded photos live on the /data volume, not in public/ (that's bundled
// at build time and wouldn't see anything uploaded after a deploy), so
// they're served dynamically here instead.
import type { APIRoute } from "astro";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { uploadsPath } from "../../lib/uploads";

export const prerender = false;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const GET: APIRoute = ({ params }) => {
  const name = params.path ?? "";
  // Reject anything that isn't a bare filename this app wrote itself --- no
  // traversal out of the uploads dir.
  if (!name || name.includes("/") || name.includes(".."))
    return new Response("not found", { status: 404 });

  const filePath = uploadsPath(name);
  const type = CONTENT_TYPES[path.extname(name).toLowerCase()];
  if (!type || !existsSync(filePath)) return new Response("not found", { status: 404 });

  return new Response(readFileSync(filePath), {
    headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
  });
};
