import type { APIRoute } from "astro";
import { logAction } from "../../lib/audit";
import { db } from "../../lib/db";
import { houseAccess } from "../../lib/houses";
import { postImages, posts } from "../../lib/schema";
import { MAX_IMAGES_PER_POST, saveUpload, UploadRejected, writeUpload } from "../../lib/uploads";

export const prerender = false;

const CATEGORIES = new Set(["emotional", "practical"]);

// Posts into one house: /api/posts?house=<slug> (the compose form's action
// carries it), membership checked before a single byte is written.
export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const { person, house } = access;
  if (!form) return new Response("expected a form body", { status: 400 });

  const category = String(form.get("category") ?? "");
  const body = String(form.get("body") ?? "").trim();
  // <input name="images" multiple>: one field, several files.
  const images = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);

  if (!CATEGORIES.has(category)) return new Response("invalid category", { status: 400 });
  if (!body) return new Response("post needs some text", { status: 400 });
  if (images.length > MAX_IMAGES_PER_POST)
    return new Response(`at most ${MAX_IMAGES_PER_POST} images per post`, { status: 400 });

  // Validate (and name) every image before writing any bytes, so a rejected
  // 3rd image doesn't leave the first two orphaned on disk.
  const names: string[] = [];
  try {
    for (const image of images) names.push(saveUpload(image));
  } catch (err) {
    if (err instanceof UploadRejected) return new Response(err.message, { status: 400 });
    throw err;
  }
  for (const [i, image] of images.entries()) await writeUpload(names[i], image);

  const { id: postId } = db
    .insert(posts)
    .values({ houseId: house.id, authorId: person.id, category, body })
    .returning({ id: posts.id })
    .get();

  for (const [position, path] of names.entries())
    db.insert(postImages).values({ postId, path, position }).run();

  logAction(person, "post_create", `house=${house.slug} id=${postId} category=${category}`);
  return redirect(`/h/${encodeURIComponent(house.slug)}`, 303);
};
