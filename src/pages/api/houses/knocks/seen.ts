import type { APIRoute } from "astro";
import { currentPerson } from "../../../../lib/identity";
import { markKnocksSeen } from "../../../../lib/knocks";

export const prerender = false;

// "I've been told": the street page calls this after it shows, live, that a
// door you knocked on was answered --- so the same news isn't repeated on
// your next visit. POST knock=<id>. Only ever touches the caller's own
// knocks (markKnocksSeen filters on person), and only answered ones. Not
// logged: it changes nothing anyone else can see.
export const POST: APIRoute = async ({ request, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("log in first", { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response("expected a form-encoded body", { status: 400 });
  const id = Number(form.get("knock") ?? "");
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("which knock?", { status: 400 });
  markKnocksSeen(person.id, [id]);
  return new Response(null, { status: 204 });
};
