"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth-client";
import { formatDuration } from "@/lib/utils";

const BEACON_INTERVAL_MS = 5000;
// Floor between any two recordProgress emissions, regardless of source
// (interval tick, pause, unmount). Prevents a mount/unmount storm or a
// pause/resume flutter from collapsing dozens of identical mutations into
// one tRPC batch — we saw 53 in a single request after a hydration-induced
// re-render cascade. Picked < BEACON_INTERVAL_MS so the steady-state 5 s
// tick still lands.
const MIN_EMIT_GAP_MS = 1500;
// Anything below this position is treated as "not started" and never emitted.
// Avoids the cleanup-time flush firing a useless `positionSec=0` write the
// instant a player mounts and unmounts before the user pressed play.
const MIN_EMIT_POSITION_SEC = 1;

interface UseWatchBeaconOptions {
    videoId: string;
    getPositionSec: () => number;
    seek: (seconds: number) => void;
}

/**
 * Sends watch progress every 5 s, on pause, and on unmount. Loads saved
 * progress on mount and offers a resume toast.
 *
 * Why not navigator.sendBeacon? Browsers coerce sendBeacon's Content-Type
 * to `text/plain` to skirt CORS preflight, which breaks tRPC's body parser
 * (it sees `req.json()` succeed but the un-batched POST shape no longer
 * matches what the procedure parser expects, and Zod fires "Required").
 * `fetch(..., { keepalive: true })` survives unload and keeps the JSON
 * Content-Type intact — it's the right tool for this job.
 *
 * Skips all beacon logic when the viewer is not signed in.
 */
export const useWatchBeacon = ({ videoId, getPositionSec, seek }: UseWatchBeaconOptions): void => {
    const { data: session } = useSession();
    const isSignedIn = !!session?.user;
    const utils = api.useUtils();
    const recordProgress = api.video.recordProgress.useMutation();
    const hasOfferedResume = useRef(false);

    // Stable refs for things the interval / cleanup closes over. Without
    // these the effect's cleanup captures whatever values were live the
    // tick the effect ran, and a re-render storm can fire many cleanups
    // back-to-back with stale data.
    const getPositionRef = useRef(getPositionSec);
    const recordRef = useRef(recordProgress);
    useEffect(() => {
        getPositionRef.current = getPositionSec;
        recordRef.current = recordProgress;
    });

    // Last position+timestamp we actually sent. Module-style refs (not
    // state) — we never want a re-render off this, and the floor must
    // hold across cleanup→remount cycles for the same videoId.
    const lastEmitMsRef = useRef(0);
    const lastEmitPosRef = useRef(-1);

    const sendProgress = useCallback(
        (rawPositionSec: number) => {
            const positionSec = Math.floor(rawPositionSec);
            if (!Number.isFinite(positionSec)) return;
            if (positionSec < MIN_EMIT_POSITION_SEC) return;
            const now = Date.now();
            if (now - lastEmitMsRef.current < MIN_EMIT_GAP_MS && positionSec === lastEmitPosRef.current) {
                // Identical position emitted very recently — drop it. We still
                // honour fresh positions inside the gap so a real pause-then-
                // seek-then-pause sequence isn't lost.
                return;
            }
            lastEmitMsRef.current = now;
            lastEmitPosRef.current = positionSec;
            recordRef.current.mutate({ videoId, positionSec });
        },
        [videoId],
    );

    useEffect(() => {
        if (!isSignedIn) return;
        if (hasOfferedResume.current) return;
        hasOfferedResume.current = true;

        void utils.video.getProgress
            .fetch({ videoId })
            .then((progress) => {
                if (!progress) return;
                const { positionSec, completed } = progress;
                if (positionSec > 5 && !completed) {
                    // Resume immediately so the user is dropped back where
                    // they left off without waiting for the toast to dismiss.
                    // Vidstack queues seek() calls received before canPlay,
                    // so this is safe even if the player isn't fully loaded
                    // when getProgress resolves. The toast acts as the undo
                    // affordance for an unintended resume.
                    seek(positionSec);
                    const label = formatDuration(positionSec);
                    toast(`Resumed from ${label}`, {
                        duration: 8000,
                        action: { label: "Restart", onClick: () => seek(0) },
                    });
                }
            })
            .catch(() => {
                // Not authenticated or no progress — ignore.
            });
    }, [videoId, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isSignedIn) return;

        const interval = setInterval(() => sendProgress(getPositionRef.current()), BEACON_INTERVAL_MS);

        return () => {
            clearInterval(interval);
            // Best-effort flush on unmount / navigation. The send-progress
            // floor above absorbs the case where this fires repeatedly
            // because something upstream is re-keying the effect.
            sendProgress(getPositionRef.current());
        };
    }, [videoId, isSignedIn, sendProgress]);
};

/** Hook that returns a `flushProgress(positionSec)` callback — call from
 *  the player's onPause to record progress at the moment of pause. The
 *  callback is rate-limited the same way as the periodic beacon so a
 *  flutter of paused→playing→paused transitions can't spam the server. */
export const useFlushProgress = (videoId: string): ((positionSec: number) => void) => {
    const recordProgress = api.video.recordProgress.useMutation();
    const recordRef = useRef(recordProgress);
    useEffect(() => {
        recordRef.current = recordProgress;
    });
    const lastEmitMsRef = useRef(0);
    const lastEmitPosRef = useRef(-1);

    return useCallback(
        (rawPositionSec: number) => {
            const positionSec = Math.floor(rawPositionSec);
            if (!Number.isFinite(positionSec)) return;
            if (positionSec < MIN_EMIT_POSITION_SEC) return;
            const now = Date.now();
            if (now - lastEmitMsRef.current < MIN_EMIT_GAP_MS && positionSec === lastEmitPosRef.current) return;
            lastEmitMsRef.current = now;
            lastEmitPosRef.current = positionSec;
            recordRef.current.mutate({ videoId, positionSec });
        },
        [videoId],
    );
};
