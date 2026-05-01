"use client";

import { useMediaState } from "@vidstack/react";
import { X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { formatDuration } from "@/lib/utils";

interface NextVideo {
    id: string;
    title: string;
    thumbnailPath: string | null;
    channel: { name: string; handle: string };
    durationSec: number | null;
    source?: "queue" | "channel";
}

interface UpNextOverlayProps {
    next: NextVideo | null;
    /**
     * Fires once when this overlay triggers a navigation (auto-advance OR
     * click-through). The Player uses this to pop the queue head when the
     * candidate came from the queue.
     */
    onAdvance?: () => void;
}

const POPOUT_COUNTDOWN_SEC = 10;
const ENDSCREEN_COUNTDOWN_SEC = 5;
// Up-next chrome stays out of the way on short videos — there's no point
// showing a 10-second pre-end popout on a 6-second clip. Threshold matches
// what the user sees as "long enough to warrant continuation UI".
const MIN_DURATION_FOR_UPNEXT_SEC = 15;

/**
 * Shows two distinct surfaces, both gated on the current video being longer
 * than MIN_DURATION_FOR_UPNEXT_SEC:
 *
 *   1. Bottom-right pre-end popout during the last 10 seconds — small card
 *      with a countdown ring, click anywhere to advance immediately, X to
 *      dismiss.
 *   2. Full-canvas end screen on `ended` — large next-video card centred,
 *      explicit "Play now" + "Cancel" buttons, plus a 5-second auto-advance
 *      countdown that the user can stop with Cancel.
 *
 * The auto-advance is what keeps the queue feeling like a real queue;
 * Cancel is the escape hatch when you'd rather replay or pick something
 * else.
 */
export const UpNextOverlay = ({ next, onAdvance }: UpNextOverlayProps) => {
    const duration = useMediaState("duration");
    const currentTime = useMediaState("currentTime");
    const ended = useMediaState("ended");
    const [dismissed, setDismissed] = useState(false);
    const [endscreenCountdown, setEndscreenCountdown] = useState(ENDSCREEN_COUNTDOWN_SEC);
    const router = useRouter();
    const hasNavigated = useRef(false);

    const timeLeft = Math.max(0, duration - currentTime);
    const longEnough = duration >= MIN_DURATION_FOR_UPNEXT_SEC;

    const showPopout = !!next && !dismissed && !ended && longEnough && timeLeft <= POPOUT_COUNTDOWN_SEC && duration > 0;
    const showEndScreen = !!next && !dismissed && ended && longEnough;

    const popoutCountdown = Math.ceil(timeLeft);
    const popoutProgress = 1 - timeLeft / POPOUT_COUNTDOWN_SEC;

    // Single navigation gate — onAdvance? lets the parent pop the queue head
    // when the candidate's source is "queue".
    const advance = () => {
        if (!next || hasNavigated.current) return;
        hasNavigated.current = true;
        onAdvance?.();
        router.push(`/watch/${next.id}`);
    };

    // End-screen auto-advance countdown. Resets to 5s every time the video
    // re-ends (e.g. after a manual seek-back) and decrements once a second.
    useEffect(() => {
        if (!showEndScreen) {
            setEndscreenCountdown(ENDSCREEN_COUNTDOWN_SEC);
            return;
        }
        const id = setInterval(() => {
            setEndscreenCountdown((n) => {
                if (n <= 1) {
                    clearInterval(id);
                    advance();
                    return 0;
                }
                return n - 1;
            });
        }, 1000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showEndScreen]);

    // Short videos auto-advance immediately on `ended` — no end-screen UX is
    // appropriate at that scale, just go to the next item.
    useEffect(() => {
        if (ended && next && !dismissed && !longEnough && !hasNavigated.current) {
            advance();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ended, next, dismissed, longEnough]);

    if (!next) return null;

    const isQueued = next.source === "queue";

    if (showEndScreen) {
        return (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-4 pointer-events-auto">
                <div className="surface-glass w-full max-w-md overflow-hidden rounded-2xl text-white shadow-2xl">
                    <div className="px-5 pb-2 pt-5 text-center">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/55">
                            {isQueued ? "Up next · From your queue" : "Up next"}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={advance}
                        className="group block w-full text-left"
                        aria-label={`Play ${next.title}`}
                    >
                        <div className="relative aspect-video bg-black/50">
                            {next.thumbnailPath ? (
                                <Image
                                    src={`/api/hls/${next.id}/thumb/sprite.jpg`}
                                    alt=""
                                    fill
                                    unoptimized
                                    className="object-cover transition-opacity duration-200 group-hover:opacity-90"
                                />
                            ) : (
                                <div className="h-full w-full bg-secondary" />
                            )}
                            {next.durationSec != null && next.durationSec > 0 && (
                                <span className="absolute bottom-2 right-2 rounded-md bg-black/85 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                                    {formatDuration(next.durationSec)}
                                </span>
                            )}
                        </div>
                        <div className="space-y-0.5 px-5 py-4">
                            <p className="line-clamp-2 text-base font-semibold leading-snug">{next.title}</p>
                            <p className="text-xs text-white/60">{next.channel.name}</p>
                        </div>
                    </button>

                    <div className="flex items-center gap-3 px-5 pb-5">
                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={advance}
                            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            <span>Play now</span>
                            <span aria-live="polite" className="text-xs tabular-nums opacity-80">
                                {endscreenCountdown}s
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!showPopout) return null;

    return (
        <div
            className={`surface-glass pointer-events-auto absolute bottom-24 right-4 z-40 w-64 overflow-hidden rounded-xl shadow-2xl duration-300 animate-in fade-in slide-in-from-right-4`}
        >
            <div className="flex items-center justify-between px-3 pb-1 pt-3">
                <span className="text-xs font-medium uppercase tracking-wider text-white/60">
                    {isQueued ? "Up Next · Queue" : "Up Next"}
                </span>
                <button
                    aria-label="Dismiss"
                    onClick={() => setDismissed(true)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <X size={16} strokeWidth={2.5} />
                </button>
            </div>

            <div className="relative cursor-pointer" onClick={advance}>
                <div className="relative aspect-video bg-black/50">
                    {next.thumbnailPath ? (
                        <Image
                            src={`/api/hls/${next.id}/thumb/sprite.jpg`}
                            alt=""
                            fill
                            unoptimized
                            className="object-cover"
                        />
                    ) : (
                        <div className="h-full w-full bg-secondary" />
                    )}
                </div>

                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <CountdownRing progress={popoutProgress} seconds={popoutCountdown} />
                </div>
            </div>

            <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-white">{next.title}</p>
                <p className="mt-0.5 text-xs text-white/50">{next.channel.name}</p>
                {next.durationSec && (
                    <p className="text-xs tabular-nums text-white/40">{formatDuration(next.durationSec)}</p>
                )}
            </div>
        </div>
    );
};

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CountdownRing = ({ progress, seconds }: { progress: number; seconds: number }) => (
    <div className="relative flex h-14 w-14 items-center justify-center">
        <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
            <circle
                cx="28"
                cy="28"
                r={RADIUS}
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
                style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
        </svg>
        <span className="text-base font-semibold tabular-nums text-white">{seconds}</span>
    </div>
);
