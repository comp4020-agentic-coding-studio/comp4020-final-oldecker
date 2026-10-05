import type { APIRoute } from "astro";
import { COLORS, createPerson } from "../../lib/identity";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const color = String(form.get("color") ?? "");

  if (!name) return new Response("name is required", { status: 400 });
  if (!COLORS.includes(color as (typeof COLORS)[number]))
    return new Response("invalid color", { status: 400 });

  createPerson(cookies, name, color);
  return redirect("/", 303);
};
