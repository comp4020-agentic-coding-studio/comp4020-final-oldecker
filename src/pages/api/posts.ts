import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { currentPerson } from "../../lib/identity";
import { postImages, posts } from "../../lib/schema";
import { MAX_IMAGES_PER_POST, saveUpload, UploadRejected, writeUpload } from "../../lib/uploads";

export const prerender = false;

const CATEGORIES = new Set(["emotional", "practical"]);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const form = await request.formData();
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
    .values({ authorId: person.id, category, body })
    .returning({ id: posts.id })
    .get();

  for (const [position, path] of names.entries())
    db.insert(postImages).values({ postId, path, position }).run();

  return redirect("/", 303);
};
