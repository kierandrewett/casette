import Link from "next/link";

import { cn } from "@/lib/utils";

interface EmptyShelfCardProps {
    /** Lucide / hugeicons component to render at the top of the card. */
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
    title: string;
    description: string;
    cta?: { label: string; href: string };
    /** Match the dimensions of the populated cards on the same shelf. */
    variant?: "video" | "playlist";
    className?: string;
}

// Subtle illustrated empty card for use as the only child of a LibraryRow.
// Sized to roughly match a real card (16:9 thumb + footer ≈ 14rem tall, w-80
// for video shelves, w-44 for the squarer playlist tiles) so the shelf does
// not visually collapse when no entries exist.
export const EmptyShelfCard = ({
    Icon,
    title,
    description,
    cta,
    variant = "video",
    className,
}: EmptyShelfCardProps) => {
    const dimensions = variant === "playlist" ? "h-56 w-44" : "h-56 w-80";
    return (
        <div
            className={cn(
                // Border is a touch stronger in light mode (border/90) so the
                // dashed outline reads against the near-white background; the
                // dark theme uses a softer border to avoid harsh contrast.
                "flex flex-shrink-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 text-center dark:border-border/60",
                "transition-colors hover:bg-card/60",
                dimensions,
                className,
            )}
        >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
                <Icon size={28} strokeWidth={1.5} />
            </span>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
            {cta && (
                <Link
                    href={cta.href}
                    className="mt-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                    {cta.label} →
                </Link>
            )}
        </div>
    );
};
