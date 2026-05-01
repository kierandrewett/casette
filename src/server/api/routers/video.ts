import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { channelMembers } from "@/server/db/schema/channels";
import { transcodeJobs } from "@/server/db/schema/jobs";
import { videos } from "@/server/db/schema/videos";

export const videoRouter = createTRPCRouter({
    // Poll the transcoding status for a video the caller uploaded.
    // The caller must be a member of the channel that owns the video.
    uploadStatus: protectedProcedure
        .input(z.object({ videoId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
            // Load the video to determine its channel.
            const videoRows = await ctx.db
                .select({ channelId: videos.channelId })
                .from(videos)
                .where(eq(videos.id, input.videoId))
                .limit(1);

            const video = videoRows[0];
            if (!video) {
                return null;
            }

            // Verify the caller is a member of the channel that owns the video.
            const memberRows = await ctx.db
                .select({ role: channelMembers.role })
                .from(channelMembers)
                .where(
                    and(
                        eq(channelMembers.channelId, video.channelId),
                        eq(channelMembers.userId, ctx.user.id),
                    ),
                )
                .limit(1);

            if (!memberRows[0]) {
                return null;
            }

            // Return the latest transcode_jobs row for this video.
            const jobRows = await ctx.db
                .select({
                    state: transcodeJobs.state,
                    progress: transcodeJobs.progress,
                    step: transcodeJobs.step,
                    message: transcodeJobs.message,
                    finishedAt: transcodeJobs.finishedAt,
                })
                .from(transcodeJobs)
                .where(eq(transcodeJobs.videoId, input.videoId))
                .orderBy(desc(transcodeJobs.createdAt))
                .limit(1);

            return jobRows[0] ?? null;
        }),
});
