import { describe, it, expect } from "vitest";
import { parseVtt } from "@/lib/transcript/parse";

describe("parseVtt", () => {
    it("returns empty array for empty string", () => {
        expect(parseVtt("")).toEqual([]);
    });

    it("returns empty array for whitespace-only input", () => {
        expect(parseVtt("   \n\n  ")).toEqual([]);
    });

    it("returns empty array for null-ish input", () => {
        // @ts-expect-error — deliberate runtime guard test
        expect(parseVtt(null)).toEqual([]);
        // @ts-expect-error
        expect(parseVtt(undefined)).toEqual([]);
    });

    it("strips the UTF-8 BOM at the start of the file", () => {
        const vtt = "﻿WEBVTT\n\n00:01.000 --> 00:02.000\nHello BOM\n";
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Hello BOM");
    });

    // -----------------------------------------------------------------------
    // Timestamp formats
    // -----------------------------------------------------------------------

    it("parses h:mm:ss.ms timestamps correctly", () => {
        const vtt = [
            "WEBVTT",
            "",
            "00:01:23.456 --> 00:01:25.789",
            "First cue",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.startSec).toBeCloseTo(83.456, 3);
        expect(cues[0]!.endSec).toBeCloseTo(85.789, 3);
    });

    it("parses m:ss.ms timestamps (no explicit hours)", () => {
        const vtt = [
            "WEBVTT",
            "",
            "01:23.456 --> 01:25.789",
            "Short timestamp cue",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.startSec).toBeCloseTo(83.456, 3);
        expect(cues[0]!.endSec).toBeCloseTo(85.789, 3);
    });

    it("handles hours greater than 1", () => {
        const vtt = "WEBVTT\n\n01:30:00.000 --> 01:30:05.500\nLong video cue\n";
        const cues = parseVtt(vtt);
        expect(cues[0]!.startSec).toBeCloseTo(5400, 0);
        expect(cues[0]!.endSec).toBeCloseTo(5405.5, 1);
    });

    // -----------------------------------------------------------------------
    // Multi-line cues
    // -----------------------------------------------------------------------

    it("joins multi-line cue text with a single space", () => {
        const vtt = [
            "WEBVTT",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "Line one",
            "line two",
            "line three",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Line one line two line three");
    });

    // -----------------------------------------------------------------------
    // Tag stripping
    // -----------------------------------------------------------------------

    it("strips voice tags (<v Speaker>)", () => {
        const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Alice>Hello there</v>\n";
        const [cue] = parseVtt(vtt);
        expect(cue!.text).toBe("Hello there");
    });

    it("strips italic and bold tags", () => {
        const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<i>italics</i> and <b>bold</b>\n";
        const [cue] = parseVtt(vtt);
        expect(cue!.text).toBe("italics and bold");
    });

    it("strips timing / class tags (<c>, <ruby>, <rt>)", () => {
        const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<c.yellow>Coloured text</c>\n";
        const [cue] = parseVtt(vtt);
        expect(cue!.text).toBe("Coloured text");
    });

    it("strips nested tags", () => {
        const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Bob><i>nested <b>tags</b></i></v>\n";
        const [cue] = parseVtt(vtt);
        expect(cue!.text).toBe("nested tags");
    });

    // -----------------------------------------------------------------------
    // Block skipping
    // -----------------------------------------------------------------------

    it("skips NOTE blocks", () => {
        const vtt = [
            "WEBVTT",
            "",
            "NOTE This is a comment",
            "still in the note block",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "Real cue",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Real cue");
    });

    it("skips STYLE blocks", () => {
        const vtt = [
            "WEBVTT",
            "",
            "STYLE",
            "::cue { color: white; }",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "Styled cue",
            "",
        ].join("\n");

        expect(parseVtt(vtt)).toHaveLength(1);
    });

    it("skips REGION blocks", () => {
        const vtt = [
            "WEBVTT",
            "",
            "REGION",
            "id:region1",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "Region cue",
            "",
        ].join("\n");

        expect(parseVtt(vtt)).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // Cue identifiers
    // -----------------------------------------------------------------------

    it("handles cues with a numeric identifier line", () => {
        const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nIdentified cue\n";
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Identified cue");
    });

    it("handles cues with a string identifier line", () => {
        const vtt = "WEBVTT\n\nintro\n00:00:01.000 --> 00:00:03.000\nIntro cue\n";
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Intro cue");
    });

    // -----------------------------------------------------------------------
    // Cue settings on timing line
    // -----------------------------------------------------------------------

    it("ignores cue settings (position, align, line) on the timing line", () => {
        const vtt = [
            "WEBVTT",
            "",
            "00:00:01.000 --> 00:00:03.000 position:50% align:center line:90%",
            "Settings cue",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Settings cue");
    });

    // -----------------------------------------------------------------------
    // Malformed timing
    // -----------------------------------------------------------------------

    it("silently drops cues with malformed timing lines", () => {
        const vtt = [
            "WEBVTT",
            "",
            "bad-timing-line",
            "This cue has no arrow",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "Good cue",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        // The malformed block is skipped; only the good cue remains.
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("Good cue");
    });

    it("drops cues where only the end time is malformed", () => {
        const vtt = "WEBVTT\n\n00:00:01.000 --> NOTATIME\nBad end cue\n";
        expect(parseVtt(vtt)).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Multiple cues, ordering
    // -----------------------------------------------------------------------

    it("parses multiple cues in order", () => {
        const vtt = [
            "WEBVTT",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "First",
            "",
            "00:00:05.000 --> 00:00:07.000",
            "Second",
            "",
            "00:00:09.000 --> 00:00:11.000",
            "Third",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(3);
        expect(cues[0]!.text).toBe("First");
        expect(cues[1]!.text).toBe("Second");
        expect(cues[2]!.text).toBe("Third");
    });

    it("sorts out-of-order cues by start time", () => {
        const vtt = [
            "WEBVTT",
            "",
            "00:00:09.000 --> 00:00:11.000",
            "Third",
            "",
            "00:00:01.000 --> 00:00:03.000",
            "First",
            "",
        ].join("\n");

        const cues = parseVtt(vtt);
        expect(cues[0]!.text).toBe("First");
        expect(cues[1]!.text).toBe("Third");
    });

    it("handles CRLF line endings", () => {
        const vtt = "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:03.000\r\nCRLF cue\r\n";
        const cues = parseVtt(vtt);
        expect(cues).toHaveLength(1);
        expect(cues[0]!.text).toBe("CRLF cue");
    });
});
