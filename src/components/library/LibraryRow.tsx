import Link from "next/link";

import { cn } from "@/lib/utils";

interface LibraryRowProps {
    heading: string;
    /** Optional "see all" destination shown on the right side of the header. */
    seeAllHref?: string;
    /** Optional caption rendered under the heading (e.g. count, hint). */
    caption?: string;
    children: React.ReactNode;
    className?: string;
}

// Apple-TV-style "shelf" wrapper: heading + "see all" link, then a horizontally
// scrollable row of cards. Empty-state copy is rendered by callers via
// <EmptyShelfCard /> so each shelf can customise its illustration + CTA.
export const LibraryRow = ({ heading, seeAllHref, caption, children, className }: LibraryRowProps) => {
    return (
        <section className={cn("space-y-3", className)}>
            <div className="flex items-end justify-between gap-3 px-4 md:px-6">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
                    {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
                </div>
                {seeAllHref && (
                    <Link
                        href={seeAllHref}
                        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        See all
                    </Link>
                )}
            </div>
            <div
                className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-3 md:px-6"
                style={{ scrollbarWidth: "none" }}
            >
                {children}
            </div>
        </section>
    );
};
