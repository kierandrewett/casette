import { bigint, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { citext } from "./_types";
import { user } from "./auth";

export const channels = pgTable(
    "channels",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        // citext makes "@kieran" and "@Kieran" collide on insert.
        handle: citext("handle").notNull().unique(),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        avatarPath: text("avatar_path"),
        bannerPath: text("banner_path"),
        ownerId: text("owner_id")
            .notNull()
            .references(() => user.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        handleIdx: uniqueIndex("channels_handle_idx").on(t.handle),
        ownerIdx: index("channels_owner_idx").on(t.ownerId),
    }),
);

export const channelMembers = pgTable(
    "channel_members",
    {
        channelId: uuid("channel_id")
            .notNull()
            .references(() => channels.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        role: text("role", { enum: ["owner", "manager", "uploader"] }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.channelId, t.userId] }),
    }),
);

// Channel-scoped API keys for the upload endpoint.
//
// Plaintext format: `vid_<22-char-nanoid>` (~131 bits of entropy). We store
// the sha256 hash in `keyHash` and the visible prefix in `keyPrefix` (first
// 12 chars of the plaintext) so the studio UI can render a partial after the
// one-time reveal. Lookup is keyed on the prefix, then narrowed by a
// constant-time hash compare.
export const apiKeys = pgTable(
    "api_keys",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        channelId: uuid("channel_id")
            .notNull()
            .references(() => channels.id, { onDelete: "cascade" }),
        createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
        name: text("name").notNull(),
        keyPrefix: text("key_prefix").notNull(),
        keyHash: text("key_hash").notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
        useCount: bigint("use_count", { mode: "number" }).notNull().default(0),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        channelIdx: index("api_keys_channel_idx").on(t.channelId),
        prefixIdx: uniqueIndex("api_keys_prefix_idx").on(t.keyPrefix),
        liveIdx: index("api_keys_live_idx").on(t.channelId, t.revokedAt),
    }),
);

export type Channel = typeof channels.$inferSelect;
export type ChannelInsert = typeof channels.$inferInsert;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type ChannelRole = ChannelMember["role"];
export type ApiKey = typeof apiKeys.$inferSelect;
