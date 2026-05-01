import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import { cleanupVideoFiles } from "@/lib/cleanup";
import { logger } from "@/lib/log";
import { captureException } from "@/lib/error-monitoring";
import { recordAudit } from "@/lib/audit";
import { db } from "@/server/db/client";
import { channels } from "@/server/db/schema/channels";
import { videos } from "@/server/db/schema/videos";

const log = logger("prune");

// ---------------------------------------------------------------------------
// Daily prune job — pg-boss handler
// ---------------------------------------------------------------------------

/**
 * Prunes public videos older than `autoPruneDays` for channels that have the
 * setting enabled. Private and unlisted videos are never pruned.
 *
 * Runs daily at 03:00 UTC via boss.schedule("prune-old-videos", "0 3 * * *").
 */
export const pruneHandler = async (_jobs: Array<{ data: Record<string, never> }>): Promise<void> => {
    try {
        await runPrune();
    } catch (err) {
        log.error("prune job failed", { err: err instanceof Error ? err.message : String(err) });
        captureException(err);
    }
};

const runPrune = async (): Promise<void> => {
    // Load all channels with autoPruneDays set.
    const channelRows = await db
        .select({
            id: channels.id,
            handle: channels.handle,
            autoPruneDays: channels.autoPruneDays,
        })
        .from(channels)
        .where(isNotNull(channels.autoPruneDays));

    if (channelRows.length === 0) {
        log.info("no channels with auto-prune configured");
        return;
    }

    log.info("running auto-prune", { channelCount: channelRows.length });

    for (const channel of channelRows) {
        const days = channel.autoPruneDays!;
        try {
            await pruneChannel(channel.id, channel.handle, days);
        } catch (err) {
            // Best-effort: log and continue to next channel.
            log.error("auto-prune failed for channel", {
                channelId: channel.id,
                handle: channel.handle,
                err: err instanceof Error ? err.message : String(err),
            });
            captureException(err);
        }
    }
};

const pruneChannel = async (channelId: string, channelHandle: string, days: number): Promise<void> => {
    // Find public+ready videos older than `days` days.
    const cutoff = sql`now() - interval '${sql.raw(String(days))} days'`;

    const candidates = await db
        .select({
            id: videos.id,
            sourcePath: videos.sourcePath,
            title: videos.title,
            publishedAt: videos.publishedAt,
        })
        .from(videos)
        .where(
            and(
                eq(videos.channelId, channelId),
                eq(videos.privacy, "public"),
                eq(videos.status, "ready"),
                isNotNull(videos.publishedAt),
                lt(videos.publishedAt, cutoff),
            ),
        );

    if (candidates.length === 0) {
        log.info("no videos to prune", { channelId, days });
        return;
    }

    log.info("pruning videos", { channelId, count: candidates.length, days });

    let pruned = 0;

    for (const video of candidates) {
        try {
            await db.delete(videos).where(eq(videos.id, video.id));
            void cleanupVideoFiles({
                videoId: video.id,
                sourcePath: video.sourcePath,
                channelHandle,
            });
            pruned++;
        } catch (err) {
            log.error("failed to prune video", {
                videoId: video.id,
                err: err instanceof Error ? err.message : String(err),
            });
            captureException(err);
        }
    }

    recordAudit({
        action: "video.autoPrune",
        targetType: "channel",
        targetId: channelId,
        details: { count: pruned, channelId, days },
    });

    log.info("auto-prune complete", { channelId, pruned, days });
};
