import Link from "next/link";

import { PlaySquareIcon, GlobeIcon, LockIcon, EyeIcon } from "hugeicons-react";

import { cn } from "@/lib/utils";

interface PlaylistTileProps {
    id: string;
    title: string;
    privacy: "public" | "unlisted" | "private";
    /** Optional item count badge rendered over the icon plate. */
    itemCount?: number;
    className?: string;
}

const PrivacyIcon = ({ privacy }: { privacy: PlaylistTileProps["privacy"] }) => {
    if (privacy === "public") return <GlobeIcon size={12} strokeWidth={1.6} />;
    if (privacy === "unlisted") return <EyeIcon size={12} strokeWidth={1.6} />;
    return <LockIcon size={12} strokeWidth={1.6} />;
};

// Playlist tile sized identically to <CreatePlaylistTile />. The "thumbnail"
// is a flat plate carrying a play-square icon — once we wire up real playlist
// thumbnails, this component is the single replacement point.
export const PlaylistTile = ({ id, title, privacy, itemCount, className }: PlaylistTileProps) => {
    return (
        <Link
            href={`/playlist/${id}`}
            className={cn(
                "group flex h-56 w-44 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200",
                "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                className,
            )}
        >
            <div className="relative flex flex-1 items-center justify-center bg-gradient-to-br from-secondary/60 to-secondary/20 text-muted-foreground transition-colors group-hover:text-foreground">
                <PlaySquareIcon size={36} strokeWidth={1.4} />
                {itemCount !== undefined && (
                    <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                        {itemCount} {itemCount === 1 ? "video" : "videos"}
                    </span>
                )}
            </div>
            <div className="flex flex-col gap-1 px-3 py-3">
                <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{title}</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <PrivacyIcon privacy={privacy} />
                    {privacy}
                </span>
            </div>
        </Link>
    );
};
