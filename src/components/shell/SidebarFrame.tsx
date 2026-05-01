"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/store/sidebar";

import { LeftRail, type UserChannel } from "./LeftRail";

interface SidebarFrameProps {
    /** Owned channels for the "Your channels" section. */
    channels: UserChannel[];
    /** Subscribed channels for the "Subscriptions" section. */
    subscriptions: UserChannel[];
    isAdmin: boolean;
    isAuthenticated: boolean;
    /** When true the rail is permanently hidden — the /watch page wants
     *  the full viewport regardless of the user's toggle preference. */
    forceHidden: boolean;
    children: React.ReactNode;
}

// Client wrapper that drives both the LeftRail visibility and the main
// content's left padding from the shared sidebar store. AppShell stays a
// server component (it fetches session + channels + subscriptions) and
// hands those down to this thin client frame.
//
// The hamburger in AppHeader writes to the same store via toggle().
export const SidebarFrame = ({
    channels,
    subscriptions,
    isAdmin,
    isAuthenticated,
    forceHidden,
    children,
}: SidebarFrameProps) => {
    const open = useSidebarStore((s) => s.open);
    const visible = !forceHidden && open;

    // Mirror the visibility into a data attribute on <html> so any CSS
    // that wants to react to rail state (rare, but useful for global
    // overrides like fullscreen player) can do it without prop-drilling.
    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.dataset.sidebar = visible ? "open" : "closed";
    }, [visible]);

    return (
        <>
            {visible && (
                <div className="hidden md:block">
                    <LeftRail
                        channels={channels}
                        subscriptions={subscriptions}
                        isAdmin={isAdmin}
                        isAuthenticated={isAuthenticated}
                    />
                </div>
            )}

            <main
                className={cn("transition-[padding] duration-200", visible && "md:pl-[var(--rail-width)]")}
                id="main-content"
            >
                {children}
            </main>
        </>
    );
};
