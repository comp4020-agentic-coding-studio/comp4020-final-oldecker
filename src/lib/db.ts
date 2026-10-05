// Opens the one SQLite file this whole app persists to, and applies any
// committed migration that hasn't run yet. Imported once per server process
// (Astro SSR, not per request), so this runs once at boot --- in Docker,
// right as the container starts; in `astro dev`, on first request after a
// restart.
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

// /data is the Fly volume (see fly.toml); DB_PATH overrides it for local dev
// so you're not reaching into a path that doesn't exist outside Docker.
const dbPath = process.env.DB_PATH ?? "./data/app.db";
mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
