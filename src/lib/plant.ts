// The plant's health is computed at read time from who's watered it since
// the week's fixed start --- no counter to keep in sync, no cron to decay
// it. A quiet week shows up as a thirstier plant the next time anyone
// looks, which is the whole mechanic: it dries out if fewer than THRESHOLD
// distinct people open the site and water it in a week. "The week" is a
// fixed calendar week (Monday 00:00, Australia/Canberra), not a rolling
// lookback --- see mostRecentCanberraMonday() in week.ts, and PROCESS.md
// for why that changed from this file's original rolling-7-day version.
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { plant, waterings } from "./schema";
import { mostRecentCanberraMonday } from "./week";

export const WEEKLY_THRESHOLD = 5;
const DEFAULT_NAME = "the plant";
export const MAX_NAME_LENGTH = 30;

export type PlantStage = "wilting" | "thirsty" | "okay" | "thriving";

export interface PlantHealth {
  waterersThisWeek: number;
  threshold: number;
  /** 0 (bone dry) to 1+ (thriving); not clamped, so a big week is visible. */
  ratio: number;
  stage: PlantStage;
}

// Every house has its own plant: same mechanic, its own waterings.
export function plantHealth(houseId: number): PlantHealth {
  const since = mostRecentCanberraMonday();
  const row = db
    .select({ count: sql<number>`count(distinct ${waterings.personId})` })
    .from(waterings)
    .where(and(eq(waterings.houseId, houseId), sql`${waterings.wateredAt} >= ${since}`))
    .get();
  const waterersThisWeek = row?.count ?? 0;
  const ratio = waterersThisWeek / WEEKLY_THRESHOLD;

  const stage: PlantStage = ratio >= 1 ? "thriving" : ratio >= 0.6 ? "okay" : ratio >= 0.2 ? "thirsty" : "wilting";

  return { waterersThisWeek, threshold: WEEKLY_THRESHOLD, ratio, stage };
}

export function recordWatering(houseId: number, personId: string): void {
  db.insert(waterings).values({ houseId, personId }).run();
}

export function plantName(houseId: number): string {
  return db.select({ name: plant.name }).from(plant).where(eq(plant.houseId, houseId)).get()?.name ?? DEFAULT_NAME;
}

// Upsert on house_id (unique), so a house's first rename creates its row
// and every later one updates it --- the pre-houses row (id 1) simply
// belongs to the first house.
export function setPlantName(houseId: number, name: string): void {
  db.insert(plant)
    .values({ houseId, name })
    .onConflictDoUpdate({ target: plant.houseId, set: { name, updatedAt: sql`(unixepoch())` } })
    .run();
}
