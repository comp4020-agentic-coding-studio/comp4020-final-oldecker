// The plant's health is computed at read time from who's watered it in the
// last 7 days --- no counter to keep in sync, no cron to decay it. A quiet
// week shows up as a thirstier plant the next time anyone looks, which is
// the whole mechanic: it dries out if fewer than THRESHOLD distinct people
// open the site and water it in a week.
import { sql } from "drizzle-orm";
import { db } from "./db";
import { waterings } from "./schema";

export const WEEKLY_THRESHOLD = 5;
const WEEK_SECONDS = 60 * 60 * 24 * 7;

export type PlantStage = "wilting" | "thirsty" | "okay" | "thriving";

export interface PlantHealth {
  waterersThisWeek: number;
  threshold: number;
  /** 0 (bone dry) to 1+ (thriving); not clamped, so a big week is visible. */
  ratio: number;
  stage: PlantStage;
}

export function plantHealth(): PlantHealth {
  const since = Math.floor(Date.now() / 1000) - WEEK_SECONDS;
  const row = db
    .select({ count: sql<number>`count(distinct ${waterings.personId})` })
    .from(waterings)
    .where(sql`${waterings.wateredAt} >= ${since}`)
    .get();
  const waterersThisWeek = row?.count ?? 0;
  const ratio = waterersThisWeek / WEEKLY_THRESHOLD;

  const stage: PlantStage = ratio >= 1 ? "thriving" : ratio >= 0.6 ? "okay" : ratio >= 0.2 ? "thirsty" : "wilting";

  return { waterersThisWeek, threshold: WEEKLY_THRESHOLD, ratio, stage };
}

export function recordWatering(personId: string): void {
  db.insert(waterings).values({ personId }).run();
}
