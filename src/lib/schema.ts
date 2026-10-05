// The smallest schema that can carry this week's core interaction: someone
// posts a little update (with up to 3 photos), and the shared plant records
// who's watered it. Everything here is additive-only for now --- archiving
// (posts) and pruning (old waterings) are next week's layer.
import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Lightweight identity: a name + a colour, no password. Good enough for a
// closed group of ~15 people behind a shared link, not a public app.
export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

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
  // null while live; set once the 3-month archive sweep moves it off the
  // main board. Not written yet --- next week's layer.
  archivedAt: integer("archived_at"),
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
