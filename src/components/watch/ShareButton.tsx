"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Code2, Link2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
    videoId: string;
    /** The unlisted slug, if applicable. Appended as ?slug=<slug> for unlisted videos. */
    slug?: string | null;
    /** If true, clipboard copy is disabled and a tooltip explains why. */
    isPrivate?: boolean;
}

export const ShareButton = ({ videoId, slug, isPrivate = false }: ShareButtonProps) => {
    const [open, setOpen] = useState(false);
    const [copiedKind, setCopiedKind] = useState<"link" | "embed" | null>(null);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Embed options state.
    const [embedOptionsOpen, setEmbedOptionsOpen] = useState(false);
    const [embedAutoplay, setEmbedAutoplay] = useState(false);
    const [embedMuted, setEmbedMuted] = useState(true); // default muted when autoplay
    const [embedLoop, setEmbedLoop] = useState(false);
    const [embedStart, setEmbedStart] = useState(0);

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const url = `${origin}/watch/${videoId}${slug ? `?slug=${slug}` : ""}`;

    // Feature-detect Web Share API. On mobile (viewport <= 768 px) we hand off
    // to the OS share sheet directly instead of opening the Popover.
    const canNativeShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 768px)").matches;

    const embedSrc = useMemo(() => {
        const params = new URLSearchParams();
        if (slug) params.set("slug", slug);
        if (embedAutoplay) params.set("autoplay", "1");
        if (embedMuted || embedAutoplay) params.set("muted", "1");
        if (embedLoop) params.set("loop", "1");
        if (embedStart > 0) params.set("start", String(embedStart));
        const qs = params.toString();
        return `${origin}/embed/${videoId}${qs ? `?${qs}` : ""}`;
    }, [origin, videoId, slug, embedAutoplay, embedMuted, embedLoop, embedStart]);

    const embedSnippet = useMemo(
        () =>
            `<iframe src="${embedSrc}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
        [embedSrc],
    );

    const flashCopied = (kind: "link" | "embed") => {
        setCopiedKind(kind);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedKind(null), 1500);
    };

    const handleCopyLink = async () => {
        if (isPrivate) return;
        try {
            await navigator.clipboard.writeText(url);
            flashCopied("link");
        } catch {
            // Fallback: user can manually select the input contents.
        }
    };

    const handleCopyEmbed = async () => {
        if (isPrivate) return;
        try {
            await navigator.clipboard.writeText(embedSnippet);
            flashCopied("embed");
        } catch {
            // Fallback only.
        }
    };

    const handleNativeShare = () => {
        if (!canNativeShare) return;
        void navigator.share({ title: document.title, url });
    };

    useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

    // On mobile with Web Share API: bypass the Popover entirely.
    if (canNativeShare) {
        return (
            <button
                type="button"
                onClick={handleNativeShare}
                className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground/80",
                    "hover:text-foreground hover:bg-white/5 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label="Share this video"
            >
                <ShareIcon />
                <span>Share</span>
            </button>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-foreground/80",
                        "hover:text-foreground hover:bg-white/5 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    aria-label="Share this video"
                >
                    <ShareIcon />
                    <span>Share</span>
                </button>
            </PopoverTrigger>

            <PopoverContent className="w-96 space-y-4 p-4" align="end">
                <p className="text-sm font-semibold text-foreground">Share</p>

                {/* Link section */}
                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Link</p>
                    <Input
                        readOnly
                        value={url}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 text-xs font-mono text-foreground/80 bg-secondary/50"
                        aria-label="Video URL"
                    />
                    {isPrivate ? (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block w-full">
                                        <Button
                                            variant="secondary"
                                            className="w-full opacity-50 cursor-not-allowed"
                                            disabled
                                            aria-disabled="true"
                                        >
                                            <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                            Copy link
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    Playback of this video requires a signed-in member. The link is only
                                    accessible to authorised viewers.
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleCopyLink}
                            aria-live="polite"
                        >
                            {copiedKind === "link" ? (
                                <>
                                    <Check className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Copy link
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {/* Embed section. Hidden on private (the iframe could not load). */}
                {isPrivate ? null : (
                    <div className="space-y-2 border-t border-border pt-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Embed
                        </p>
                        <textarea
                            readOnly
                            value={embedSnippet}
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                            className="flex-1 h-20 w-full resize-none rounded-md border border-border bg-secondary/50 p-2 text-[11px] font-mono text-foreground/80"
                            aria-label="Embed snippet"
                        />

                        {/* Options disclosure */}
                        <button
                            type="button"
                            onClick={() => setEmbedOptionsOpen((v) => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            aria-expanded={embedOptionsOpen}
                        >
                            {embedOptionsOpen
                                ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                            Options
                        </button>

                        {embedOptionsOpen && (
                            <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
                                <EmbedCheckbox
                                    id="embed-autoplay"
                                    label="Autoplay"
                                    checked={embedAutoplay}
                                    onChange={(v) => {
                                        setEmbedAutoplay(v);
                                        if (v) setEmbedMuted(true); // autoplay requires muted
                                    }}
                                />
                                <EmbedCheckbox
                                    id="embed-muted"
                                    label="Muted"
                                    checked={embedMuted || embedAutoplay}
                                    onChange={setEmbedMuted}
                                    disabled={embedAutoplay}
                                />
                                <EmbedCheckbox
                                    id="embed-loop"
                                    label="Loop"
                                    checked={embedLoop}
                                    onChange={setEmbedLoop}
                                />
                                <div className="flex items-center gap-2">
                                    <label htmlFor="embed-start" className="text-xs text-muted-foreground w-24 shrink-0">
                                        Start at (s)
                                    </label>
                                    <input
                                        id="embed-start"
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={embedStart}
                                        onChange={(e) => setEmbedStart(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                        className="w-20 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                                    />
                                </div>
                            </div>
                        )}

                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleCopyEmbed}
                            aria-live="polite"
                        >
                            {copiedKind === "embed" ? (
                                <>
                                    <Check className="mr-2 h-4 w-4 text-green-500" aria-hidden="true" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Code2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Copy embed code
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};

const EmbedCheckbox = ({
    id,
    label,
    checked,
    onChange,
    disabled = false,
}: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) => (
    <div className="flex items-center gap-2">
        <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="h-3.5 w-3.5 accent-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <label
            htmlFor={id}
            className={cn("text-xs text-muted-foreground cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}
        >
            {label}
        </label>
    </div>
);

const ShareIcon = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} aria-hidden="true">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="16 6 12 2 8 6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="2" x2="12" y2="15" strokeLinecap="round" />
    </svg>
);
