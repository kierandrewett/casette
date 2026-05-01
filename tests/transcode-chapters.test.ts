import { describe, expect, it } from "vitest";

import { CHAPTER_REGEX, parseDescriptionChapters } from "@/lib/transcode/chapters";

// ------------------------------------------------------------------
// Unit tests for description chapter parsing
// ------------------------------------------------------------------

describe("CHAPTER_REGEX", () => {
    const matching: Array<[string, { startSec: number; title: string }]> = [
        ["0:00 Intro", { startSec: 0, title: "Intro" }],
        ["0:00 - Intro", { startSec: 0, title: "Intro" }],
        ["0:00 – Introduction", { startSec: 0, title: "Introduction" }],
        ["0:00 — Opening", { startSec: 0, title: "Opening" }],
        ["1:23 Main section", { startSec: 83, title: "Main section" }],
        ["01:23 - Main section", { startSec: 83, title: "Main section" }],
        ["1:23:45 – Part two", { startSec: 5025, title: "Part two" }],
        ["01:23:45 Part two", { startSec: 5025, title: "Part two" }],
        ["  0:00 Intro  ", { startSec: 0, title: "Intro" }],
        ["10:00 Ten minute mark", { startSec: 600, title: "Ten minute mark" }],
        ["59:59 Last minute", { startSec: 3599, title: "Last minute" }],
        ["1:00:00 - One hour", { startSec: 3600, title: "One hour" }],
    ];

    it.each(matching)("matches: %s", (line, expected) => {
        const match = CHAPTER_REGEX.exec(line);
        expect(match).not.toBeNull();

        const hours = match![1] ? parseInt(match![1], 10) : 0;
        const minutes = parseInt(match![2] ?? "0", 10);
        const seconds = parseInt(match![3] ?? "0", 10);
        const title = (match![4] ?? "").trim();

        const startSec = hours * 3600 + minutes * 60 + seconds;
        expect(startSec).toBe(expected.startSec);
        expect(title).toBe(expected.title);
    });

    const nonMatching: string[] = [
        "No timestamp here",
        "Just some text",
        "123 not a timestamp",
        "x:00 bad hours",
        "0:0 too short seconds",
        "",
    ];

    it.each(nonMatching)("does not match: %s", (line) => {
        expect(CHAPTER_REGEX.exec(line)).toBeNull();
    });
});

describe("parseDescriptionChapters", () => {
    it("returns empty array when no timestamps match", () => {
        const desc = "No timestamps\nJust text\nSome more text";
        expect(parseDescriptionChapters(desc)).toEqual([]);
    });

    it("returns empty array when first chapter is not at 00:00", () => {
        const desc = "1:00 Chapter one\n2:00 Chapter two";
        expect(parseDescriptionChapters(desc)).toEqual([]);
    });

    it("parses a standard YouTube-style chapter list", () => {
        const desc = [
            "0:00 Intro",
            "1:30 Main Content",
            "5:00 Conclusion",
        ].join("\n");
        const chapters = parseDescriptionChapters(desc);
        expect(chapters).toHaveLength(3);
        expect(chapters[0]).toMatchObject({ startSec: 0, title: "Intro", source: "description" });
        expect(chapters[1]).toMatchObject({ startSec: 90, title: "Main Content", source: "description" });
        expect(chapters[2]).toMatchObject({ startSec: 300, title: "Conclusion", source: "description" });
    });

    it("ignores non-timestamp lines mixed in", () => {
        const desc = [
            "Here is my great video!",
            "",
            "0:00 - Intro",
            "Check out my other videos",
            "2:30 - Main Part",
            "5:45 - Outro",
            "Subscribe for more!",
        ].join("\n");
        const chapters = parseDescriptionChapters(desc);
        expect(chapters).toHaveLength(3);
        expect(chapters[0]?.startSec).toBe(0);
        expect(chapters[1]?.startSec).toBe(150);
        expect(chapters[2]?.startSec).toBe(345);
    });

    it("handles hour-based timestamps", () => {
        const desc = [
            "0:00 Start",
            "1:00:00 One hour mark",
            "1:30:00 One thirty",
        ].join("\n");
        const chapters = parseDescriptionChapters(desc);
        expect(chapters).toHaveLength(3);
        expect(chapters[1]?.startSec).toBe(3600);
        expect(chapters[2]?.startSec).toBe(5400);
    });

    it("sorts chapters ascending by startSec", () => {
        // Out-of-order descriptions are valid but unlikely; sort handles them.
        const desc = [
            "2:00 - Part two",
            "0:00 - Intro",
            "1:00 - Part one",
        ].join("\n");
        const chapters = parseDescriptionChapters(desc);
        expect(chapters.map((c) => c.startSec)).toEqual([0, 60, 120]);
    });

    it("handles em-dash and en-dash separators", () => {
        const desc = [
            "0:00 — Intro",
            "1:00 – Part one",
        ].join("\n");
        const chapters = parseDescriptionChapters(desc);
        expect(chapters).toHaveLength(2);
        expect(chapters[0]?.title).toBe("Intro");
        expect(chapters[1]?.title).toBe("Part one");
    });

    it("returns empty array for empty string", () => {
        expect(parseDescriptionChapters("")).toEqual([]);
    });
});
