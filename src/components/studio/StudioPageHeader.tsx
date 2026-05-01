import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StudioPageHeaderProps {
    title: string;
    /** Subhead copy. Plain string or rich children (links, tooltips). */
    description?: ReactNode;
    /** Primary/secondary CTAs rendered in the right gutter on md+. */
    actions?: ReactNode;
    className?: string;
}

// Single page-header surface used by every studio page. Keeps the title
// rhythm, copy size, and CTA placement consistent so the section identity
// reads the same on every tab. The actions slot floats right on md+ and
// stacks below the heading on small viewports.
export const StudioPageHeader = ({ title, description, actions, className }: StudioPageHeaderProps) => {
    return (
        <header
            className={cn(
                "mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between md:gap-6",
                className,
            )}
        >
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
                {description && <p className="mt-1.5 text-sm text-muted-foreground md:max-w-2xl">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
};
