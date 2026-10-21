// The smallest schema that can carry this week's core interaction: someone
// posts a little update (with up to 3 photos), and the shared plant records
// who's watered it. Pruning (old waterings) is still unbuilt --- see
// waterings' own comment, and auditLog's below, for why that's fine so far.
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Identity: a name + a password + an avatar. The avatar is a compact JSON
// face config (see src/lib/face.ts; older rows hold a legacy creature id
// from src/lib/avatars.ts), not a colour --- it's what shows up in the live
// presence strip (crit 9's multi-user decision), so it has to be more
// legible at a glance than a colour swatch was.
//
// passwordHash and nameKey are both NULL for "legacy" rows: people who joined
// back when identity was just a name and a cookie. Those rows are kept ---
// posts, scores and photos reference them and must keep rendering --- but with
// no password they can never log in, so they are display-only authors now.
// nameKey is the lower-cased, whitespace-normalised name, and is what's
// unique (case-insensitively) among real accounts: SQLite can't add a UNIQUE
// constraint with ALTER TABLE, but a unique index over a nullable column
// does the same job here, and treats every NULL as distinct --- so legacy
// duplicate names ("Ole" twice) can't break the migration, and a new
// account may still reuse a legacy display name (audit lines carry the id
// prefix, so they stay distinguishable).
export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    avatar: text("avatar").notNull(),
    passwordHash: text("password_hash"),
    nameKey: text("name_key"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex("people_name_key_unique").on(table.nameKey)],
);

// One row per logged-in browser. `id` is the SHA-256 of the random token in
// the cookie, never the token itself, so a leaked database (or backup) can't
// be replayed as logins. Rooms (a later phase) would hang off people, not
// sessions, so nothing here needs to change for them.
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sessions_person_idx").on(table.personId)],
);

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: text("author_id")
    .notNull()
    .references(() => people.id),
  // "emotional" | "practical" --- the two update categories from the brief.
  category: text("category").notNull(),
  body: text("body").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const postImages = sqliteTable("post_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  // relative path under the uploads dir, e.g. "3f9a.../0.jpg"
  path: text("path").notNull(),
  position: integer("position").notNull(),
});

// One vote per person per post: the ❄️<->🔥 slider's actual value, -100 to
// 100. Sign is which end (cold/hot), magnitude is how far they dragged it.
// Nothing about this is shown as a raw number in the UI --- only the slider
// and the emoji it maps to --- but the real value is what's stored, and
// what "sort by extremest" sorts on (see src/lib/temperature.ts).
export const postScores = sqliteTable(
  "post_scores",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    score: integer("score").notNull(),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.postId, table.personId] })],
);

// A single row (id always 1): the plant's name, the one piece of shared
// state anyone can rename. Not per-person --- there's one plant.
export const plant = sqliteTable("plant", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// One row per person per watering tap. The plant's health is a read-time
// query over this table (distinct waterers in the last 7 days), not a
// stored counter --- nothing to keep in sync, nothing a missed write can
// desync.
export const waterings = sqliteTable("waterings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: text("person_id")
    .notNull()
    .references(() => people.id),
  wateredAt: integer("watered_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// Append-only "who did what": every mutation in the app writes one row here
// (see src/lib/audit.ts), which is both a durable DB trail and the source of
// each console line a crit presenter reads live off `flyctl logs`. personId
// is nullable --- the 60-day post-expiry sweep is a system action with no
// person to attribute it to, and blaming the original author would make an
// automatic expiry look, in the logs, like that person deleting their own
// post. Like waterings, this is unbounded/unpruned --- fine for ~15 people
// over a semester, same honesty as this file's other "good enough for now,
// not at a different scale" calls.
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: text("person_id").references(() => people.id),
    action: text("action").notNull(),
    detail: text("detail").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("audit_log_person_action_idx").on(table.personId, table.action, table.createdAt)],
);

// A single row (id always 1): the canvas's name, same renameable-by-anyone
// shape as `plant` above --- kept in its own table rather than folded into
// `plant` since the two are unrelated pieces of shared state that just
// happen to share a UI pattern.
export const canvasMeta = sqliteTable("canvas_meta", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// One row per cell of the shared pixel canvas (src/lib/canvas.ts) --- (x, y)
// is the primary key, so placing over an existing pixel is an upsert, not a
// new row: the canvas is "what color is each cell right now", not a history
// of every placement (the audit log already carries that, via pixel_place
// rows, for anyone who wants it).
export const pixels = sqliteTable(
  "pixels",
  {
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    colorIndex: integer("color_index").notNull(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    placedAt: integer("placed_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [primaryKey({ columns: [table.x, table.y] })],
);

// Who's currently in the shared party room, and until when --- personId
// IS the primary key (not a surrogate), so re-joining while already in is
// a plain upsert, which is exactly "re-adding refreshes your timer" rather
// than a second row to dedupe. Persisted, not an in-memory Map like
// events.ts's `present`: that Map is safe to lose on restart because its
// fact ("this connection is open") is re-derived for free the moment a tab
// reconnects, but "joined less than ~2h ago" outlives the SSE connection,
// and fly.toml's auto_stop_machines/min_machines_running:0 means the
// process restarts specifically during the idle gaps between visits ---
// exactly when no open tab would be there to silently repair an in-memory
// wipe. See src/lib/party.ts.
export const partyGuests = sqliteTable("party_guests", {
  personId: text("person_id")
    .primaryKey()
    .references(() => people.id),
  joinedAt: integer("joined_at")
    .notNull()
    .default(sql`(unixepoch())`),
  expiresAt: integer("expires_at").notNull(),
});
