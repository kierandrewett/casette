import Link from "next/link";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

interface StudioEmptyStateProps {
    icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    title: string;
    description?: string;
    cta?: { label: string; href: string };
    className?: string;
}

// Polished empty state for studio surfaces. Used by Overview / Videos when a
// new channel has no uploads yet. Sits inside a card-shaped dashed border
// with a centred icon, copy, and optional CTA — same shape used by the
// /home recently-uploaded empty slot so the studio reads as a member of the
// same product.
export const StudioEmptyState = ({ icon: Icon, title, description, cta, className }: StudioEmptyStateProps) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center",
                className,
            )}
        >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/60 text-foreground">
                <Icon size={24} strokeWidth={1.6} />
            </span>
            <p className="text-base font-semibold text-foreground">{title}</p>
            {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
            {cta && (
                <Link
                    href={cta.href}
                    className="mt-5 inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                    {cta.label}
                </Link>
            )}
        </div>
    );
};
