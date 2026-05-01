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

// Client wrapper that drives the LeftRail's slide-in/out animation and the
// main content's matching left-padding from the shared sidebar store.
// AppShell stays a server component (it fetches session + channels +
// subscriptions) and hands those into this thin client frame.
//
// The hamburger in AppHeader writes to the same store via toggle().
//
// Implementation notes:
//   - The rail is always mounted so the slide animation has somewhere to
//     animate FROM. We toggle visibility via translate-x + pointer-events
//     instead of conditionally rendering — that's what gives the smooth
//     in/out instead of an abrupt remount.
//   - aria-hidden + tabIndex flip when closed so keyboard users skip past
//     the rail's links and screen readers don't announce them.
//   - The /watch override (`forceHidden`) is treated like an explicit
//     close so the same animation runs.
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

    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.dataset.sidebar = visible ? "open" : "closed";
    }, [visible]);

    return (
        <>
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-width)] md:block",
                    "transition-transform duration-200 ease-out",
                    !visible && "pointer-events-none -translate-x-full",
                )}
                aria-hidden={!visible}
            >
                <LeftRail
                    channels={channels}
                    subscriptions={subscriptions}
                    isAdmin={isAdmin}
                    isAuthenticated={isAuthenticated}
                />
            </div>

            <main
                className={cn(
                    "transition-[padding] duration-200 ease-out",
                    visible && "md:pl-[var(--rail-width)]",
                )}
                id="main-content"
            >
                {children}
            </main>
        </>
    );
};
