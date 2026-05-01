import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { channelBandwidthDaily } from "@/server/db/schema/metrics";

/** Current UTC day bucket: floor(ms / ms-per-day). */
const dayBucket = (): number => Math.floor(Date.now() / 86_400_000);

/**
 * Fire-and-forget bandwidth counter. Upserts a row for the current UTC day,
 * atomically incrementing the byte counter. Never throws — any DB error is
 * swallowed so segment responses are never blocked.
 */
export async function recordBandwidth({ channelId, bytes }: { channelId: string; bytes: number }): Promise<void> {
    if (bytes <= 0) return;

    try {
        await db
            .insert(channelBandwidthDaily)
            .values({
                channelId,
                bucket: dayBucket(),
                bytes,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [channelBandwidthDaily.channelId, channelBandwidthDaily.bucket],
                set: {
                    bytes: sql`${channelBandwidthDaily.bytes} + excluded.bytes`,
                    updatedAt: new Date(),
                },
            });
    } catch {
        // Best-effort; never propagate to the caller.
    }
}
