"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThemeChoice = "system" | "dark" | "light";

const STORAGE_KEY = "cassette.theme";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const applyTheme = (choice: ThemeChoice): void => {
    const html = document.documentElement;
    if (choice === "dark") {
        html.classList.add("dark");
    } else if (choice === "light") {
        html.classList.remove("dark");
    } else {
        // System: follow prefers-color-scheme.
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
            html.classList.add("dark");
        } else {
            html.classList.remove("dark");
        }
    }
};

const readStoredTheme = (): ThemeChoice => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === "dark" || raw === "light" || raw === "system") return raw;
    } catch {
        // localStorage unavailable.
    }
    return "system";
};

const storeTheme = (choice: ThemeChoice): void => {
    try {
        localStorage.setItem(STORAGE_KEY, choice);
    } catch {
        // Quota or private mode — ignore.
    }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Monitor }[] = [
    { value: "system", label: "System", Icon: Monitor },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
];

export const ThemeToggle = () => {
    const [choice, setChoice] = useState<ThemeChoice>("system");

    // Initialise from storage on mount.
    useEffect(() => {
        setChoice(readStoredTheme());
    }, []);

    // Apply theme whenever choice changes, and wire up the system media query.
    useEffect(() => {
        applyTheme(choice);

        if (choice !== "system") return;

        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => applyTheme("system");
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [choice]);

    const handleSelect = (next: ThemeChoice) => {
        setChoice(next);
        storeTheme(next);
    };

    return (
        <div className="px-4 py-4">
            <p className="mb-3 text-sm font-medium text-foreground">Colour scheme</p>
            <div
                className="inline-flex gap-1 rounded-xl border border-border bg-secondary p-1"
                role="radiogroup"
                aria-label="Colour scheme"
            >
                {OPTIONS.map(({ value, label, Icon }) => (
                    <button
                        key={value}
                        role="radio"
                        aria-checked={choice === value}
                        onClick={() => handleSelect(value)}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                            choice === value
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {label}
                    </button>
                ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                &ldquo;System&rdquo; follows your operating system&rsquo;s preference.
            </p>
        </div>
    );
};
