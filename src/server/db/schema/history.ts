import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { videos } from "./videos";

// Append-only watch history. Old rows are retained until the user clears them
// or removes a single entry.
export const watchHistory = pgTable(
    "watch_history",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        videoId: uuid("video_id")
            .notNull()
            .references(() => videos.id, { onDelete: "cascade" }),
        watchedAt: timestamp("watched_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        userIdx: index("watch_history_user_idx").on(t.userId, t.watchedAt.desc()),
    }),
);

// Last known playback position per user-video. Upserted by the watch beacon
// every ~5 s during playback.
export const watchProgress = pgTable(
    "watch_progress",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        videoId: uuid("video_id")
            .notNull()
            .references(() => videos.id, { onDelete: "cascade" }),
        positionSec: integer("position_sec").notNull(),
        durationSec: integer("duration_sec").notNull(),
        completed: boolean("completed").notNull().default(false),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.userId, t.videoId] }),
        userIdx: index("watch_progress_user_idx").on(t.userId, t.updatedAt.desc()),
    }),
);

// View counter de-dupe. session_hash is sha256(ip + ua + day-bucket) for
// anonymous viewers, or the userId for logged-in viewers. The 30-minute
// bucket is computed in app code (`Math.floor(Date.now() / 1_800_000)`) and
// stored in `bucket`, so the unique index is a plain composite without any
// expression-based parts — Postgres requires expressions in indexes to be
// IMMUTABLE, which date_trunc on a tz-aware timestamp is not.
export const viewSessions = pgTable(
    "view_sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        videoId: uuid("video_id")
            .notNull()
            .references(() => videos.id, { onDelete: "cascade" }),
        sessionHash: text("session_hash").notNull(),
        bucket: integer("bucket").notNull(),
        userId: text("user_id"),
        countedAt: timestamp("counted_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        dedupe: uniqueIndex("view_sessions_dedupe").on(t.videoId, t.sessionHash, t.bucket),
        videoIdx: index("view_sessions_video_idx").on(t.videoId),
    }),
);

export type WatchHistory = typeof watchHistory.$inferSelect;
export type WatchProgress = typeof watchProgress.$inferSelect;
export type ViewSession = typeof viewSessions.$inferSelect;
