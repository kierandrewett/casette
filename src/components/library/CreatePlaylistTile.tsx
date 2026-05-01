"use client";

import { useState } from "react";

import { PlusSignIcon } from "hugeicons-react";

import { CreatePlaylistDialog } from "./CreatePlaylistDialog";

interface CreatePlaylistTileProps {
    onCreated?: (id: string) => void;
}

// Tile sized to match a populated PlaylistTile (h-56 w-44). Centered HugeIcon
// + caption beneath; subtle hover lift via translate-y to feel responsive.
export const CreatePlaylistTile = ({ onCreated }: CreatePlaylistTileProps) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="group flex h-56 w-44 flex-shrink-0 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/30 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/50 hover:bg-card/60 hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="New playlist"
            >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-foreground">
                    <PlusSignIcon size={28} strokeWidth={1.6} />
                </span>
                <span className="text-sm font-medium">New playlist</span>
            </button>

            <CreatePlaylistDialog open={open} onOpenChange={setOpen} onCreated={onCreated} />
        </>
    );
};
