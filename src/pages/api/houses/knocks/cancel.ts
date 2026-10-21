import type { APIRoute } from "astro";
import { answerKnockRoute } from "../../../../lib/knock-routes";

export const prerender = false;

// The knocker walks away from the door: POST knock=<id>. Only the person who
// knocked can. Checks in src/lib/knock-routes.ts.
export const POST: APIRoute = (ctx) => answerKnockRoute(ctx, "cancelled");
