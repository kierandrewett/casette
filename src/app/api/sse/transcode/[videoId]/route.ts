import { and, desc, eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/server/db/client";
import { channelMembers } from "@/server/db/schema/channels";
import { transcodeJobs } from "@/server/db/schema/jobs";
import { videos } from "@/server/db/schema/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// SSE: live transcode-progress feed for a single video.
//
// The studio upload form previously polled `video.uploadStatus` every 2s. We
// keep that polling loop but move it server-side and push the result down
// over an event-stream so the client only has to hold a single open
// connection. The poll cadence is intentionally cheap (DB-only, single row,
// 2s) — we'd rather not wire up pg LISTEN/NOTIFY for a feature whose volume
// is "one watcher per active upload".
//
// Auth: caller must be a member of the channel that owns the video. Same
// pattern as the `video.uploadStatus` tRPC procedure.
//
// Stream lifecycle:
//   - Re-emit the latest `transcode_jobs` row whenever its `state` or
//     `progress` (or `step`/`message`) changes.
//   - Send a `:keepalive` comment every 25s so HTTP proxies (nginx, Caddy,
//     Cloudflare) don't reap the connection.
//   - Close the stream once the job reaches a terminal state ("completed"
//     or "failed").
//   - Hard cap at 10 minutes per connection — the client is expected to
//     reopen if it still needs updates.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;
const KEEPALIVE_INTERVAL_MS = 25_000;
const MAX_CONNECTION_MS = 10 * 60_000;

type ProgressPayload = {
    state: string;
    progress: number;
    step: string | null;
    message: string | null;
};

const fetchLatest = async (videoId: string): Promise<ProgressPayload | null> => {
    const rows = await db
        .select({
            state: transcodeJobs.state,
            progress: transcodeJobs.progress,
            step: transcodeJobs.step,
            message: transcodeJobs.message,
        })
        .from(transcodeJobs)
        .where(eq(transcodeJobs.videoId, videoId))
        .orderBy(desc(transcodeJobs.createdAt))
        .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
        state: row.state,
        progress: row.progress ?? 0,
        step: row.step ?? null,
        message: row.message ?? null,
    };
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ videoId: string }> }): Promise<Response> {
    const { videoId } = await ctx.params;

    // Basic shape check — we don't want to spin up a stream for a malformed id.
    if (!/^[0-9a-f-]{36}$/i.test(videoId)) {
        return new Response("Bad request", { status: 400 });
    }

    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    // Resolve the video's channel and assert the caller is either the
    // uploader or a member of the channel.
    const videoRows = await db
        .select({ channelId: videos.channelId, uploaderId: videos.uploaderId })
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);
    const video = videoRows[0];
    if (!video) {
        // Don't leak existence — a 404 is fine here because the studio
        // already knows the videoId came from its own upload response.
        return new Response("Not found", { status: 404 });
    }

    const isUploader = video.uploaderId === session.user.id;
    let allowed = isUploader;
    if (!allowed) {
        const memberRows = await db
            .select({ role: channelMembers.role })
            .from(channelMembers)
            .where(and(eq(channelMembers.channelId, video.channelId), eq(channelMembers.userId, session.user.id)))
            .limit(1);
        allowed = !!memberRows[0];
    }
    if (!allowed) {
        return new Response("Forbidden", { status: 403 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;
            let lastSig: string | null = null;

            const close = () => {
                if (closed) return;
                closed = true;
                try {
                    controller.close();
                } catch {
                    // already closed
                }
            };

            const send = (event: string, data: unknown) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                } catch {
                    closed = true;
                }
            };

            const sendComment = (comment: string) => {
                if (closed) return;
                try {
                    controller.enqueue(encoder.encode(`: ${comment}\n\n`));
                } catch {
                    closed = true;
                }
            };

            // Initial hello so EventSource fires `open` quickly even when the
            // first poll has nothing to report yet.
            sendComment("connected");

            const pollOnce = async (): Promise<boolean> => {
                const payload = await fetchLatest(videoId).catch(() => null);
                if (!payload) {
                    // No row yet — keep polling, the queue worker is about to
                    // insert one.
                    return false;
                }
                const sig = `${payload.state}|${payload.progress}|${payload.step ?? ""}|${payload.message ?? ""}`;
                if (sig !== lastSig) {
                    lastSig = sig;
                    send("progress", payload);
                }
                return payload.state === "completed" || payload.state === "failed";
            };

            // Kick off immediately so the client gets state without waiting
            // a full 2s.
            const terminal = await pollOnce();
            if (terminal) {
                close();
                return;
            }

            const pollTimer = setInterval(() => {
                void (async () => {
                    if (closed) return;
                    const done = await pollOnce().catch(() => false);
                    if (done) {
                        cleanup();
                        close();
                    }
                })();
            }, POLL_INTERVAL_MS);

            const keepaliveTimer = setInterval(() => sendComment("keepalive"), KEEPALIVE_INTERVAL_MS);

            const hardCap = setTimeout(() => {
                cleanup();
                close();
            }, MAX_CONNECTION_MS);

            const cleanup = () => {
                clearInterval(pollTimer);
                clearInterval(keepaliveTimer);
                clearTimeout(hardCap);
            };

            // Client disconnected — tear everything down.
            req.signal.addEventListener("abort", () => {
                cleanup();
                close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
