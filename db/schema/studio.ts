import {
  index,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { track } from "./vault";

// Message roles within a studio chat transcript
export const studioMessageRoleEnum = pgEnum("studio_message_role", [
  "user",
  "assistant",
  "system",
]);

// Visibility enum (Postgres enum type)
export const studioVisibilityEnum = pgEnum("studio_visibility", [
  "private",
  "public",
  "invite-only",
]);

// A studio session with a human-friendly slug; minimal fields for fast loading
export const studioSession = pgTable(
  "studio_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name"),
    description: text("description"),
    visibility: studioVisibilityEnum("visibility").notNull().default("private"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    unique("unique_user_slug").on(t.userId, t.slug),
    index("idx_studio_session_user").on(t.userId),
  ],
);

// Chat transcript and generation log for the session (lean)
export const studioMessage = pgTable(
  "studio_message",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => studioSession.id, { onDelete: "cascade" }),
    role: studioMessageRoleEnum("role").notNull(),
    content: text("content"),
    // If this message created a sound, link to the canonical vault track
    trackId: text("track_id").references(() => track.id, {
      onDelete: "set null",
    }),
    // Free-form params or client context (e.g., { isTts, durationSeconds, promptInfluence })
    metadata: json("metadata"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [
    index("idx_studio_message_session_created").on(t.sessionId, t.createdAt),
  ],
);

// Types
export type StudioSession = typeof studioSession.$inferSelect;
export type NewStudioSession = typeof studioSession.$inferInsert;

export type StudioMessage = typeof studioMessage.$inferSelect;
export type NewStudioMessage = typeof studioMessage.$inferInsert;
