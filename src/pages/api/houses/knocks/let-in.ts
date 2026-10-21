import type { APIRoute } from "astro";
import { answerKnockRoute } from "../../../../lib/knock-routes";

export const prerender = false;

// A member opens the door: POST knock=<id> (+ house=<slug>). Makes the
// knocker a member. Checks in src/lib/knock-routes.ts.
export const POST: APIRoute = (ctx) => answerKnockRoute(ctx, "let_in");
