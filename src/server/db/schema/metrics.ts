import { bigint, index, integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { channels } from "./channels";

// Daily bandwidth counters, bucketed by UTC day.
// bucket = floor(Date.now() / 86_400_000) — an integer day number.
// We use a composite PK on (channelId, bucket) so an UPSERT can atomically
// increment the bytes counter without a separate SELECT.

export const channelBandwidthDaily = pgTable(
    "channel_bandwidth_daily",
    {
        channelId: uuid("channel_id")
            .notNull()
            .references(() => channels.id, { onDelete: "cascade" }),
        bucket: integer("bucket").notNull(),
        bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.channelId, t.bucket] }),
        // Used by the per-channel series query: descending bucket scan for one channel.
        bucketChannelIdx: index("channel_bandwidth_daily_bucket_channel_idx").on(t.bucket.desc(), t.channelId),
    }),
);

export type ChannelBandwidthDaily = typeof channelBandwidthDaily.$inferSelect;
