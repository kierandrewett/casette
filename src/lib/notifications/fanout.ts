import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/server/db/client";
import { comments } from "@/server/db/schema/social";
import { notifications } from "@/server/db/schema/notifications";
import { subscriptions } from "@/server/db/schema/social";
import { videos } from "@/server/db/schema/videos";

// Fan-out helpers used by the transcode worker (new_upload) and the comment
// router (comment_reply). Each returns the number of rows inserted so the
// caller can log it; failures are best-effort and logged, not rethrown.

// Notify every subscriber of a channel that a new video is ready to watch.
// The transcode pipeline calls this from its finalise step.
export const notifyNewUpload = async (videoId: string): Promise<number> => {
    try {
        const videoRows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
        const video = videoRows[0];
        if (!video || video.status !== "ready" || video.privacy !== "public") {
            // Only fan out on public videos. Unlisted and private uploads stay
            // off the bell intentionally.
            return 0;
        }

        const subs = await db
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(and(eq(subscriptions.channelId, video.channelId), eq(subscriptions.notify, true)));

        if (subs.length === 0) return 0;

        const rows = subs.map((s) => ({
            userId: s.userId,
            kind: "new_upload" as const,
            videoId: video.id,
            channelId: video.channelId,
        }));

        const inserted = await db.insert(notifications).values(rows).returning({ id: notifications.id });
        return inserted.length;
    } catch (err) {
        console.error("[notifications] notifyNewUpload failed:", err);
        return 0;
    }
};

// Notify the parent comment's author when someone replies to them.
// The comment.create procedure calls this after a successful insert.
// A reply to your own comment does not generate a notification.
export const notifyCommentReply = async (replyCommentId: string): Promise<number> => {
    try {
        const replyRows = await db.select().from(comments).where(eq(comments.id, replyCommentId)).limit(1);
        const reply = replyRows[0];
        if (!reply || !reply.parentId) return 0;

        const parentRows = await db.select().from(comments).where(eq(comments.id, reply.parentId)).limit(1);
        const parent = parentRows[0];
        if (!parent || !parent.authorId) return 0;
        if (parent.authorId === reply.authorId) return 0;

        await db.insert(notifications).values({
            userId: parent.authorId,
            kind: "comment_reply",
            videoId: reply.videoId,
            commentId: reply.id,
        });
        return 1;
    } catch (err) {
        console.error("[notifications] notifyCommentReply failed:", err);
        return 0;
    }
};

// Best-effort marker so unused-imports lint does not fire if both helpers
// happen to live at module scope without a consumer in early commits.
const _keep = { ne, isNull };
void _keep;
