import { and, desc, eq, sql } from "drizzle-orm";
import type { APIRoute } from "astro";
import { activityLevel } from "../../../lib/activity";
import { logAction } from "../../../lib/audit";
import { cooldownRemaining, isValidColorIndex, isValidCoord } from "../../../lib/canvas";
import { db } from "../../../lib/db";
import { broadcast } from "../../../lib/events";
import { houseAccess } from "../../../lib/houses";
import { auditLog, pixels } from "../../../lib/schema";

export const prerender = false;

// Form-encoded, not JSON --- same reasoning as score.ts: Astro's origin
// check only covers a POST whose content-type is absent or form-like, so a
// JSON body here would silently skip it. The house is named in the URL
// (?house=<slug>) and checked by houseAccess() before anything is read.
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const form = await request.formData().catch(() => null);
  const access = houseAccess(cookies, url, form);
  if (access instanceof Response) return access;
  const { person, house } = access;

  const x = Number(form?.get("x"));
  const y = Number(form?.get("y"));
  const color = Number(form?.get("color"));

  if (!isValidCoord(x) || !isValidCoord(y)) return new Response("coordinates out of range", { status: 400 });
  if (!isValidColorIndex(color)) return new Response("invalid color", { status: 400 });

  // Cooldown: the most recent pixel_place row for this person, reusing the
  // audit log rather than a bespoke column --- one fewer thing to keep in
  // sync, and the log already has to carry this placement either way. Per
  // person across every house, on purpose: like the activity level that
  // sets it, it's a property of you, not of a wall, so opening a second
  // house doesn't double anyone's painting speed.
  const last = db
    .select({ createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(and(eq(auditLog.personId, person.id), eq(auditLog.action, "pixel_place")))
    .orderBy(desc(auditLog.createdAt))
    .limit(1)
    .get();

  const { level, points, cooldownSeconds } = activityLevel(person.id);
  const remaining = cooldownRemaining(last?.createdAt ?? null, cooldownSeconds);
  if (remaining > 0)
    return new Response(JSON.stringify({ remaining, cooldownSeconds, level, points }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });

  db.insert(pixels)
    .values({ houseId: house.id, x, y, colorIndex: color, personId: person.id, placedAt: sql`(unixepoch())` })
    .onConflictDoUpdate({
      target: [pixels.houseId, pixels.x, pixels.y],
      set: { colorIndex: color, personId: person.id, placedAt: sql`(unixepoch())` },
    })
    .run();

  logAction(person, "pixel_place", `house=${house.slug} x=${x} y=${y} color=${color}`);
  broadcast(house.id, { type: "pixel", data: { x, y, colorIndex: color } });

  // Placing is itself (lightly) activity, so re-derive for the response.
  const after = activityLevel(person.id);
  return new Response(
    JSON.stringify({
      x,
      y,
      colorIndex: color,
      cooldownSeconds: after.cooldownSeconds,
      level: after.level,
      points: after.points,
    }),
    { headers: { "content-type": "application/json" } },
  );
};
