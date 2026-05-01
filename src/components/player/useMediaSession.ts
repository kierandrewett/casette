"use client";

import { type MediaPlayerInstance, useMediaRemote, useMediaState } from "@vidstack/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface QueueNeighbour {
    id: string;
}

interface UseMediaSessionArgs {
    player: MediaPlayerInstance | null;
    video: {
        id: string;
        title: string;
        thumbnailPath: string | null;
    };
    channel: {
        name: string;
    };
    queue: {
        next: QueueNeighbour | null;
        prev?: QueueNeighbour | null;
    };
}

const SEEK_OFFSET_SEC = 10;

/**
 * Wires the W3C Media Session API to the active Vidstack player so OS-level
 * media controls (Android lockscreen, Linux MPRIS, macOS Now Playing) show
 * cassette metadata and can drive playback while the tab is backgrounded.
 *
 * Idempotent: re-runs whenever the video, channel, or queue neighbours
 * change. Bails early on browsers without the API (older Firefox).
 */
export const useMediaSession = ({ player, video, channel, queue }: UseMediaSessionArgs) => {
    const remote = useMediaRemote();
    const router = useRouter();
    const paused = useMediaState("paused");

    // ---- 1. Metadata ----
    useEffect(() => {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

        // The thumb endpoint hosts the worker-generated thumbnail sprite. We
        // reuse it as artwork because it is the same image VideoCard already
        // shows and it is already cached for the navigation that landed
        // on /watch.
        const artwork = video.thumbnailPath
            ? [{ src: `/api/hls/${video.id}/thumb/sprite.jpg`, sizes: "640x360", type: "image/jpeg" }]
            : [];

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: video.title,
                artist: channel.name,
                album: "cassette",
                artwork,
            });
        } catch {
            // Older Safari throws if `MediaMetadata` is partially implemented.
        }

        return () => {
            try {
                if (navigator.mediaSession) navigator.mediaSession.metadata = null;
            } catch {
                // ignore
            }
        };
    }, [video.id, video.title, video.thumbnailPath, channel.name]);

    // ---- 2. Action handlers ----
    useEffect(() => {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
        const ms = navigator.mediaSession;

        const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null): void => {
            try {
                ms.setActionHandler(action, handler);
            } catch {
                // Some browsers reject unknown actions (e.g. seekto on iOS).
            }
        };

        setHandler("play", () => remote.play());
        setHandler("pause", () => remote.pause());
        setHandler("seekbackward", (details) => {
            const offset = details?.seekOffset ?? SEEK_OFFSET_SEC;
            const t = (player?.state.currentTime ?? 0) - offset;
            remote.seek(Math.max(0, t));
        });
        setHandler("seekforward", (details) => {
            const offset = details?.seekOffset ?? SEEK_OFFSET_SEC;
            const dur = player?.state.duration ?? 0;
            const t = (player?.state.currentTime ?? 0) + offset;
            remote.seek(dur > 0 ? Math.min(dur, t) : t);
        });
        setHandler("seekto", (details) => {
            if (typeof details?.seekTime !== "number") return;
            remote.seek(details.seekTime);
        });

        setHandler("previoustrack", queue.prev ? () => router.push(`/watch/${queue.prev!.id}`) : null);
        setHandler("nexttrack", queue.next ? () => router.push(`/watch/${queue.next!.id}`) : null);

        return () => {
            // Best-effort: leave nothing behind for the next page load.
            const actions: MediaSessionAction[] = [
                "play",
                "pause",
                "seekbackward",
                "seekforward",
                "seekto",
                "previoustrack",
                "nexttrack",
            ];
            for (const a of actions) setHandler(a, null);
        };
    }, [player, remote, router, queue.next, queue.prev]);

    // ---- 3. playbackState mirror ----
    useEffect(() => {
        if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
        try {
            navigator.mediaSession.playbackState = paused ? "paused" : "playing";
        } catch {
            // ignore
        }
    }, [paused]);

    // ---- 4. Position state ----
    useEffect(() => {
        if (!player) return;
        if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
        if (typeof navigator.mediaSession.setPositionState !== "function") return;

        return player.subscribe(({ duration, currentTime, playbackRate }) => {
            // Position state is what powers the lockscreen scrubber on
            // Chrome / Android. Throttling is unnecessary — Vidstack
            // already coalesces high-frequency state updates.
            try {
                if (!Number.isFinite(duration) || duration <= 0) return;
                navigator.mediaSession.setPositionState!({
                    duration,
                    position: Math.min(currentTime, duration),
                    playbackRate: playbackRate || 1,
                });
            } catch {
                // ignore
            }
        });
    }, [player]);
};
