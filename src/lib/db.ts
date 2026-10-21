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

// Foreign keys OFF while migrating, then a full check, then back ON. This is
// SQLite's own documented recipe for rebuilding a table (create new, copy,
// drop old, rename), which is the only way to change a primary key --- the
// houses migration (drizzle/0006_houses.sql) rebuilds six tables that way.
// The PRAGMA has to be issued here, outside a transaction: the migrator
// wraps every migration in BEGIN/COMMIT, and SQLite silently ignores
// `PRAGMA foreign_keys` inside one, so a PRAGMA in the .sql file would do
// nothing. better-sqlite3 turns foreign keys ON by default, so with them on,
// DROP TABLE posts would trip post_images' reference to it.
sqlite.pragma("foreign_keys = OFF");
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
const broken = sqlite.pragma("foreign_key_check") as unknown[];
if (broken.length > 0) {
  // Loud, but not fatal: a crash here would put the one Fly machine into a
  // restart loop over what might be a single stale row, taking the whole
  // board down. The rows are still all there either way --- nothing in the
  // migrations deletes data --- so log it where `flyctl logs` shows it.
  console.error(`[db] foreign key check found ${broken.length} dangling reference(s):`, broken.slice(0, 10));
}
sqlite.pragma("foreign_keys = ON");
