import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { videos } from "./videos";

export const playlistKind = pgEnum("playlist_kind", ["user", "queue", "watch_later"]);
export const playlistPrivacy = pgEnum("playlist_privacy", ["public", "unlisted", "private"]);

// Playlists carry a kind discriminator. The system kinds (queue, watch_later)
// are managed transparently and filtered out of the user-facing playlist list,
// so the queue can sync across devices via the same playlist tables without
// ever appearing in /library's "Your playlists" section.
//
// The partial unique index enforces "at most one queue and one watch_later per
// user" without preventing the user from owning many regular playlists.
export const playlists = pgTable(
    "playlists",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        ownerId: text("owner_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        kind: playlistKind("kind").notNull().default("user"),
        title: text("title").notNull(),
        description: text("description").notNull().default(""),
        privacy: playlistPrivacy("privacy").notNull().default("private"),
        // Random slug used for unlisted playlists; null for public/private.
        unlistedSlug: text("unlisted_slug"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        ownerKindIdx: index("playlists_owner_kind_idx").on(t.ownerId, t.kind),
        uniqSystem: uniqueIndex("playlists_uniq_system_kind")
            .on(t.ownerId, t.kind)
            .where(sql`kind in ('queue','watch_later')`),
        unlistedIdx: uniqueIndex("playlists_unlisted_slug_idx").on(t.unlistedSlug),
    }),
);

export const playlistItems = pgTable(
    "playlist_items",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        playlistId: uuid("playlist_id")
            .notNull()
            .references(() => playlists.id, { onDelete: "cascade" }),
        videoId: uuid("video_id")
            .notNull()
            .references(() => videos.id, { onDelete: "cascade" }),
        position: integer("position").notNull(),
        addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        uniqPos: uniqueIndex("playlist_items_uniq_pos").on(t.playlistId, t.position),
        playlistIdx: index("playlist_items_playlist_idx").on(t.playlistId, t.position),
        videoIdx: index("playlist_items_video_idx").on(t.videoId),
    }),
);

export type Playlist = typeof playlists.$inferSelect;
export type PlaylistInsert = typeof playlists.$inferInsert;
export type PlaylistItem = typeof playlistItems.$inferSelect;
export type PlaylistKind = (typeof playlistKind.enumValues)[number];
export type PlaylistPrivacy = (typeof playlistPrivacy.enumValues)[number];
