"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
    /** Whether the LeftRail is currently rendered. */
    open: boolean;
    toggle: () => void;
    setOpen: (next: boolean) => void;
}

// Sidebar visibility state.
//
// Persisted to localStorage so the user's open/closed choice survives a
// page reload. Wrapped in `persist()` rather than re-reading from cookies
// in the server because rail visibility is purely a client concern — the
// CSS variables that control the offset are applied client-side from
// `<SidebarFrame>` once this store hydrates.
export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            open: true,
            toggle: () => set((s) => ({ open: !s.open })),
            setOpen: (next) => set({ open: next }),
        }),
        { name: "cassette.sidebar" },
    ),
);
