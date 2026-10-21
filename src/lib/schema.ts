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
    // Where "/" sends you after login: the house you last opened. A plain
    // integer, not a foreign key --- nothing breaks if it dangles, because
    // "/" re-checks membership before redirecting anywhere.
    lastHouseId: integer("last_house_id"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex("people_name_key_unique").on(table.nameKey)],
);

// A house: one independent copy of everything shared --- its own feed,
// plant, wall and party room (see PROCESS.md's "Houses" section). Accounts
// and avatars are NOT per house; they're global and walk in and out of
// every house their owner belongs to.
//
// slug is the house's identity in URLs (/h/<slug>) AND what "visit by name"
// looks up: it's derived from the name (lower-cased, punctuation to dashes,
// see src/lib/houses.ts), so two names that would read the same ("The
// Board" / "the board!") can't both exist. inviteCode is a separate random
// token for the /join/<code> link, so sharing a link doesn't mean spelling a
// name out.
export const houses = sqliteTable("houses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  // nullable: the first house was made by the migration, not by a person
  createdBy: text("created_by").references(() => people.id),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// Who may see and change a house. Checked on the server on every house page
// and every API call (src/lib/houses.ts) --- a non-member gets a 403 and
// none of the house's data. (house, person) is the key, so joining twice is
// a no-op, same shape as party_guests.
export const houseMembers = sqliteTable(
  "house_members",
  {
    houseId: integer("house_id")
      .notNull()
      .references(() => houses.id),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    joinedAt: integer("joined_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    primaryKey({ columns: [table.houseId, table.personId] }),
    index("house_members_person_idx").on(table.personId),
  ],
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
  houseId: integer("house_id")
    .notNull()
    .references(() => houses.id),
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

// One row per house (once someone renames its plant): the plant's name, the
// one piece of shared state anyone in the house can rename. A house with no
// row here just shows the default name. houseId is unique rather than being
// the key itself, so the migration could keep the pre-houses row (id 1)
// as-is and simply tag it with the first house.
export const plant = sqliteTable("plant", {
  id: integer("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .unique()
    .references(() => houses.id),
  name: text("name").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// One row per person per watering tap. The plant's health is a read-time
// query over this table (distinct waterers in the last 7 days), not a
// stored counter --- nothing to keep in sync, nothing a missed write can
// desync.
export const waterings = sqliteTable(
  "waterings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    houseId: integer("house_id")
      .notNull()
      .references(() => houses.id),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    wateredAt: integer("watered_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("waterings_house_time_idx").on(table.houseId, table.wateredAt)],
);

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

// One row per house (once renamed): the canvas's name, same renameable-by-
// anyone, unique-houseId shape as `plant` above --- kept in its own table
// rather than folded into `plant` since the two are unrelated pieces of
// shared state that just happen to share a UI pattern.
export const canvasMeta = sqliteTable("canvas_meta", {
  id: integer("id").primaryKey(),
  houseId: integer("house_id")
    .notNull()
    .unique()
    .references(() => houses.id),
  name: text("name").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

// One row per cell of each house's pixel canvas (src/lib/canvas.ts) ---
// (house, x, y) is the primary key, so placing over an existing pixel is an upsert, not a
// new row: the canvas is "what color is each cell right now", not a history
// of every placement (the audit log already carries that, via pixel_place
// rows, for anyone who wants it).
export const pixels = sqliteTable(
  "pixels",
  {
    houseId: integer("house_id")
      .notNull()
      .references(() => houses.id),
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
  (table) => [primaryKey({ columns: [table.houseId, table.x, table.y] })],
);

// Who's currently in each house's party room, and until when --- (house,
// person) IS the primary key (not a surrogate), so re-joining while already in is
// a plain upsert, which is exactly "re-adding refreshes your timer" rather
// than a second row to dedupe. Persisted, not an in-memory Map like
// events.ts's `present`: that Map is safe to lose on restart because its
// fact ("this connection is open") is re-derived for free the moment a tab
// reconnects, but "joined less than ~2h ago" outlives the SSE connection,
// and fly.toml's auto_stop_machines/min_machines_running:0 means the
// process restarts specifically during the idle gaps between visits ---
// exactly when no open tab would be there to silently repair an in-memory
// wipe. See src/lib/party.ts.
export const partyGuests = sqliteTable(
  "party_guests",
  {
    houseId: integer("house_id")
      .notNull()
      .references(() => houses.id),
    personId: text("person_id")
      .notNull()
      .references(() => people.id),
    joinedAt: integer("joined_at")
      .notNull()
      .default(sql`(unixepoch())`),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.houseId, table.personId] })],
);

// "ich hab dich lieb": one row per heart someone sent someone else, in the
// house it was sent in (src/lib/lieb.ts). seenAt is null until the recipient
// has actually been shown it --- live, if they had the house open when it
// arrived, or on their next visit otherwise. `day` is the sender's Canberra
// calendar date, and the unique index on (from, to, day) IS the once-a-day
// limit: a second insert that day is a constraint no-op, not a check-then-
// insert that two quick double-clicks could both slip past. The limit is per
// pair of people, not per house --- two houses in common don't mean two a day.
export const liebMessages = sqliteTable(
  "lieb_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    houseId: integer("house_id")
      .notNull()
      .references(() => houses.id),
    fromPersonId: text("from_person_id")
      .notNull()
      .references(() => people.id),
    toPersonId: text("to_person_id")
      .notNull()
      .references(() => people.id),
    day: text("day").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    seenAt: integer("seen_at"),
  },
  (table) => [
    uniqueIndex("lieb_once_a_day").on(table.fromPersonId, table.toPersonId, table.day),
    index("lieb_inbox_idx").on(table.houseId, table.toPersonId, table.seenAt),
  ],
);
