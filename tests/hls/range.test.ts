// Table-driven tests for src/lib/hls/range.ts
// No mocking required: parseRange has no external dependencies.

import { describe, expect, it } from "vitest";

import { parseRange } from "@/lib/hls/range";

const TOTAL = 1000;

describe("parseRange", () => {
    // --- happy paths ---

    it("bytes=0-99 (closed range)", () => {
        const result = parseRange("bytes=0-99", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 0, end: 99, length: 100 });
    });

    it("bytes=100-199 (mid-range)", () => {
        const result = parseRange("bytes=100-199", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 100, end: 199, length: 100 });
    });

    it("bytes=100- (open-ended: from 100 to EOF)", () => {
        const result = parseRange("bytes=100-", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 100, end: 999, length: 900 });
    });

    it("bytes=0- (entire file via open range)", () => {
        const result = parseRange("bytes=0-", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 0, end: 999, length: 1000 });
    });

    it("bytes=-50 (last 50 bytes / suffix form)", () => {
        const result = parseRange("bytes=-50", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 950, end: 999, length: 50 });
    });

    it("bytes=-1000 (suffix equal to total size)", () => {
        const result = parseRange("bytes=-1000", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 0, end: 999, length: 1000 });
    });

    it("bytes=-9999 (suffix larger than total: clamps to full file)", () => {
        const result = parseRange("bytes=-9999", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 0, end: 999, length: 1000 });
    });

    it("oversized end is clamped to total-1", () => {
        const result = parseRange("bytes=0-5000", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 0, end: 999, length: 1000 });
    });

    it("exact last byte (bytes=999-999)", () => {
        const result = parseRange("bytes=999-999", TOTAL);
        expect(result).toMatchObject({ ok: true, start: 999, end: 999, length: 1 });
    });

    // --- rejection cases ---

    it("rejects malformed header (no bytes= prefix)", () => {
        const result = parseRange("0-99", TOTAL);
        expect(result.ok).toBe(false);
    });

    it("rejects wrong unit (chunks=0-99)", () => {
        const result = parseRange("chunks=0-99", TOTAL);
        expect(result.ok).toBe(false);
    });

    it("rejects multi-range (bytes=0-9,20-29)", () => {
        const result = parseRange("bytes=0-9,20-29", TOTAL);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toMatch(/multi/i);
        }
    });

    it("rejects inverted range (bytes=200-100)", () => {
        const result = parseRange("bytes=200-100", TOTAL);
        expect(result.ok).toBe(false);
    });

    it("rejects start beyond EOF (bytes=1000-1099)", () => {
        const result = parseRange("bytes=1000-1099", TOTAL);
        expect(result.ok).toBe(false);
    });

    it("rejects garbage string", () => {
        const result = parseRange("bytes=abc-def", TOTAL);
        expect(result.ok).toBe(false);
    });

    it("rejects empty spec (bytes=-)", () => {
        const result = parseRange("bytes=-", TOTAL);
        expect(result.ok).toBe(false);
    });

    it("rejects double-dash (bytes=--10)", () => {
        const result = parseRange("bytes=--10", TOTAL);
        expect(result.ok).toBe(false);
    });
});
