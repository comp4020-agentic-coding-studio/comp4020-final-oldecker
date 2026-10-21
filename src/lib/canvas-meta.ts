// Each house's wall name --- same one-row-per-house, renameable-by-anyone
// shape as src/lib/plant.ts's plantName/setPlantName. Kept separate from
// src/lib/canvas.ts (the grid size/palette/cooldown math) because that
// module is imported by client scripts and has to stay free of server-only
// imports like this one (better-sqlite3 can't be bundled for the browser).
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { canvasMeta } from "./schema";

const DEFAULT_NAME = "the wall";
export const MAX_CANVAS_NAME_LENGTH = 30;

export function canvasName(houseId: number): string {
  return (
    db.select({ name: canvasMeta.name }).from(canvasMeta).where(eq(canvasMeta.houseId, houseId)).get()?.name ??
    DEFAULT_NAME
  );
}

export function setCanvasName(houseId: number, name: string): void {
  db.insert(canvasMeta)
    .values({ houseId, name })
    .onConflictDoUpdate({ target: canvasMeta.houseId, set: { name, updatedAt: sql`(unixepoch())` } })
    .run();
}
