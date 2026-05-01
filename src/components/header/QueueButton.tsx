"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ListVideo, Play, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/trpc/client";
import { cn, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// QueueButton — header chip that exposes the user's queue at a glance.
//
// Mounted in AppHeader's right cluster between Upload and Notifications. Hidden
// when the viewer is signed-out OR the queue is empty. The popover shows each
// item with a remove button, a "Play all" CTA at the top, and a link to the
// library queue shelf at the bottom.
//
// The queue list is invalidated by Add-to-queue / Play-next mutations so the
// chip count stays in sync without polling. We also refetchOnWindowFocus so a
// queue mutation in another tab eventually surfaces here.

interface QueueButtonProps {
    enabled: boolean;
}

export const QueueButton = ({ enabled }: QueueButtonProps) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const list = api.playlist.queue.list.useQuery(undefined, {
        enabled,
        refetchOnWindowFocus: true,
    });

    const utils = api.useUtils();

    const removeItem = api.playlist.removeItem.useMutation({
        onSuccess: async () => {
            await utils.playlist.queue.list.invalidate();
        },
        onError: (err) => toast.error(err.message ?? "Failed to remove from queue."),
    });

    const items = list.data ?? [];
    const count = items.length;

    // Hide the chip when there's nothing to surface. Anonymous users get the
    // `enabled=false` path and we never render the trigger button at all.
    if (!enabled || count === 0) return null;

    const head = items[0];

    const handlePlayAll = () => {
        if (!head) return;
        setOpen(false);
        router.push(`/watch/${head.video.id}`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Queue (${count} item${count === 1 ? "" : "s"})`}
                    className="relative rounded-lg text-muted-foreground hover:text-foreground"
                >
                    <ListVideo className="h-5 w-5" strokeWidth={1.6} />
                    <span
                        className={cn(
                            "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground",
                        )}
                    >
                        {count > 99 ? "99+" : count}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <p className="text-sm font-semibold">
                        Queue <span className="ml-1 text-xs font-normal text-muted-foreground">({count})</span>
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handlePlayAll}
                        className="h-7 gap-1 text-xs"
                    >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Play all
                    </Button>
                </div>

                <ScrollArea className="h-[360px]">
                    <ul className="divide-y divide-border">
                        {items.map((item) => {
                            const thumbSrc = item.video.thumbnailPath
                                ? `/api/hls/${item.video.id}/thumb/sprite.jpg`
                                : null;
                            const hasDuration = item.video.durationSec != null && item.video.durationSec > 0;
                            return (
                                <li key={item.itemId} className="group flex items-center gap-3 px-3 py-2">
                                    <Link
                                        href={`/watch/${item.video.id}`}
                                        onClick={() => setOpen(false)}
                                        className="relative aspect-video w-24 flex-shrink-0 overflow-hidden rounded-md bg-secondary"
                                    >
                                        {thumbSrc ? (
                                            <Image src={thumbSrc} alt="" fill unoptimized className="object-cover" />
                                        ) : (
                                            <div className="absolute inset-0" />
                                        )}
                                        {hasDuration && (
                                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[10px] font-medium tabular-nums text-white">
                                                {formatDuration(item.video.durationSec!)}
                                            </span>
                                        )}
                                    </Link>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/watch/${item.video.id}`}
                                            onClick={() => setOpen(false)}
                                            className="block"
                                        >
                                            <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground hover:underline">
                                                {item.video.title}
                                            </p>
                                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                                {item.channel.name}
                                            </p>
                                        </Link>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Remove from queue"
                                        disabled={removeItem.isPending}
                                        onClick={() => removeItem.mutate({ itemId: item.itemId })}
                                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground focus-visible:opacity-100 disabled:opacity-40 group-hover:opacity-100"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </ScrollArea>

                <div className="border-t border-border px-4 py-2">
                    <Link
                        href="/library#up-next"
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                        View in library
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            </PopoverContent>
        </Popover>
    );
};
