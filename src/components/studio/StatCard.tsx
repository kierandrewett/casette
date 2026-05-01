import type { ComponentType } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    label: string;
    value: string;
    /** Optional sub-value (e.g. "+12 this week") rendered in muted text below the value. */
    hint?: string;
    className?: string;
}

// Compact dashboard tile used on the studio overview. Fixed height so the
// row of cards reads as a strip rather than each tile sizing to its content.
// Icon sits in a soft accent puck top-left; metric is large and tabular so
// digits line up across cards.
export const StatCard = ({ icon: Icon, label, value, hint, className }: StatCardProps) => {
    return (
        <Card className={cn("flex flex-col gap-3 p-5", className)}>
            <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/60 text-foreground">
                    <Icon size={16} strokeWidth={1.6} />
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            <div>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
                {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
            </div>
        </Card>
    );
};
