import { and, desc, eq, sql } from "drizzle-orm";
import type { APIRoute } from "astro";
import { activityLevel } from "../../../lib/activity";
import { logAction } from "../../../lib/audit";
import { cooldownRemaining, isValidColorIndex, isValidCoord } from "../../../lib/canvas";
import { db } from "../../../lib/db";
import { broadcast } from "../../../lib/events";
import { currentPerson } from "../../../lib/identity";
import { auditLog, pixels } from "../../../lib/schema";

export const prerender = false;

// Form-encoded, not JSON --- same reasoning as score.ts: Astro's origin
// check only covers a POST whose content-type is absent or form-like, so a
// JSON body here would silently skip it.
export const POST: APIRoute = async ({ request, cookies }) => {
  const person = currentPerson(cookies);
  if (!person) return new Response("join first", { status: 401 });

  const form = await request.formData();
  const x = Number(form.get("x"));
  const y = Number(form.get("y"));
  const color = Number(form.get("color"));

  if (!isValidCoord(x) || !isValidCoord(y)) return new Response("coordinates out of range", { status: 400 });
  if (!isValidColorIndex(color)) return new Response("invalid color", { status: 400 });

  // Cooldown: the most recent pixel_place row for this person, reusing the
  // audit log rather than a bespoke column --- one fewer thing to keep in
  // sync, and the log already has to carry this placement either way.
  const last = db
    .select({ createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(and(eq(auditLog.personId, person.id), eq(auditLog.action, "pixel_place")))
    .orderBy(desc(auditLog.createdAt))
    .limit(1)
    .get();

  const { level, cooldownSeconds } = activityLevel(person.id);
  const remaining = cooldownRemaining(last?.createdAt ?? null, cooldownSeconds);
  if (remaining > 0)
    return new Response(JSON.stringify({ remaining, cooldownSeconds, level }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });

  db.insert(pixels)
    .values({ x, y, colorIndex: color, personId: person.id, placedAt: sql`(unixepoch())` })
    .onConflictDoUpdate({
      target: [pixels.x, pixels.y],
      set: { colorIndex: color, personId: person.id, placedAt: sql`(unixepoch())` },
    })
    .run();

  logAction(person, "pixel_place", `x=${x} y=${y} color=${color}`);
  broadcast({ type: "pixel", data: { x, y, colorIndex: color } });

  // Placing is itself (lightly) activity, so re-derive for the response.
  const after = activityLevel(person.id);
  return new Response(
    JSON.stringify({ x, y, colorIndex: color, cooldownSeconds: after.cooldownSeconds, level: after.level }),
    { headers: { "content-type": "application/json" } },
  );
};
