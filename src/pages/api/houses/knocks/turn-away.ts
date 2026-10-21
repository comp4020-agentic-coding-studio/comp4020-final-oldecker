import type { APIRoute } from "astro";
import { answerKnockRoute } from "../../../../lib/knock-routes";

export const prerender = false;

// A member keeps the door shut: POST knock=<id> (+ house=<slug>). The
// knocker is told once, on their street page, and may knock again later.
// Checks in src/lib/knock-routes.ts.
export const POST: APIRoute = (ctx) => answerKnockRoute(ctx, "turned_away");
