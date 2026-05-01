"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

interface ChannelPreviewProps {
    handle: string;
    name: string;
    description: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    /** Two-letter ISO 3166-1 alpha-2 code, or null. Rendered as a small badge. */
    country: string | null;
    className?: string;
}

const initialsOf = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return "??";
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
};

// Live preview of the public channel page header. Mirrors the layout and
// proportions of <ChannelHeader> at a smaller scale so the studio operator
// can see what edits look like before committing them. Reads its data from
// local form state passed by the parent, not from the network.
export const ChannelPreview = ({
    handle,
    name,
    description,
    avatarUrl,
    bannerUrl,
    country,
    className,
}: ChannelPreviewProps) => {
    const safeName = name.trim() || "Untitled channel";
    const safeDescription = description.trim();

    return (
        <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
            {/* Banner area — reserves space even when empty so the avatar
                tucks into the same place visually. */}
            <div className="relative aspect-[16/5] w-full bg-gradient-to-br from-accent/40 to-muted">
                {bannerUrl && (
                    <Image
                        src={bannerUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 480px"
                        unoptimized
                    />
                )}
            </div>

            <div className="px-5 pb-5 pt-4">
                <div className="flex items-end gap-4">
                    <div className="relative -mt-12 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-card bg-muted">
                        {avatarUrl ? (
                            <Image src={avatarUrl} alt="" fill className="object-cover" sizes="80px" unoptimized />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-muted-foreground">
                                {initialsOf(safeName)}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1 pb-1">
                        <p className="truncate text-lg font-semibold text-foreground">{safeName}</p>
                        <p className="mt-0.5 flex items-center gap-2 truncate text-sm text-muted-foreground">
                            <span className="truncate">@{handle}</span>
                            {country && (
                                <>
                                    <span aria-hidden>·</span>
                                    <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                                        {country}
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <p
                    className={cn(
                        "mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground",
                        safeDescription ? "line-clamp-4" : "italic",
                    )}
                >
                    {safeDescription || "Add a description to introduce your channel."}
                </p>
            </div>
        </div>
    );
};
