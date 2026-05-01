// Tests for src/lib/hls/sign.ts
//
// We must stub out @/env before importing the signing module because env.ts
// validates process.env at import time and throws if required vars are absent.
// Vitest's module mocking lets us intercept the import chain cleanly.

import { beforeAll, describe, expect, it, vi } from "vitest";

// Stub the env module so that HLS_SIGNING_SECRET is available without a real
// .env file. This must happen before any module that transitively imports @/env.
vi.mock("@/env", () => ({
    env: {
        HLS_SIGNING_SECRET: "test-secret-that-is-long-enough",
        NODE_ENV: "test",
        DATABASE_URL: "postgres://localhost/test",
        BETTER_AUTH_SECRET: "test-better-auth-secret-long",
        PUBLIC_URL: "http://localhost:3000",
        MEDIA_SOURCE_PATH: "/tmp/source",
        MEDIA_HLS_PATH: "/tmp/hls",
        MAX_UPLOAD_BYTES: 21474836480,
        TRANSCODE_CONCURRENCY: 1,
        ENABLE_NVENC: false,
    },
}));

// Import after mocking.
import { signToken, verifyToken } from "@/lib/hls/sign";

const VIDEO_A = "00000000-0000-0000-0000-000000000001";
const VIDEO_B = "00000000-0000-0000-0000-000000000002";
const USER_ID = "user_abc123";

describe("signToken / verifyToken", () => {
    it("round-trip: valid token verifies correctly", () => {
        const token = signToken({ videoId: VIDEO_A, userId: USER_ID });
        const result = verifyToken(token, VIDEO_A);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.userId).toBe(USER_ID);
        }
    });

    it("round-trip: null userId is preserved", () => {
        const token = signToken({ videoId: VIDEO_A, userId: null });
        const result = verifyToken(token, VIDEO_A);

        expect(result.valid).toBe(true);
        if (result.valid) {
            expect(result.userId).toBeNull();
        }
    });

    it("rejects an expired token (ttlSec=0)", async () => {
        // Sign with a 0-second TTL so the token is instantly stale.
        const token = signToken({ videoId: VIDEO_A, userId: USER_ID, ttlSec: -1 });
        const result = verifyToken(token, VIDEO_A);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/expired/i);
        }
    });

    it("rejects a token issued for video A when checking video B", () => {
        const token = signToken({ videoId: VIDEO_A, userId: USER_ID });
        const result = verifyToken(token, VIDEO_B);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/different video/i);
        }
    });

    it("rejects a token with a tampered signature", () => {
        const token = signToken({ videoId: VIDEO_A, userId: USER_ID });
        // Flip the last character of the sig portion.
        const [payload, sig] = token.split(".") as [string, string];
        const lastChar = sig.slice(-1);
        const altChar = lastChar === "A" ? "B" : "A";
        const tamperedToken = `${payload}.${sig.slice(0, -1)}${altChar}`;

        const result = verifyToken(tamperedToken, VIDEO_A);
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/signature|malformed/i);
        }
    });

    it("rejects a token with a tampered payload", () => {
        const token = signToken({ videoId: VIDEO_A, userId: USER_ID });
        const [payload, sig] = token.split(".") as [string, string];
        // Flip a character in the payload.
        const lastChar = payload.slice(-1);
        const altChar = lastChar === "A" ? "B" : "A";
        const tamperedToken = `${payload.slice(0, -1)}${altChar}.${sig}`;

        const result = verifyToken(tamperedToken, VIDEO_A);
        expect(result.valid).toBe(false);
    });

    it("rejects a completely malformed token (no dot separator)", () => {
        const result = verifyToken("thisisnotavalidtoken", VIDEO_A);
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toMatch(/malformed/i);
        }
    });

    it("rejects an empty token", () => {
        const result = verifyToken("", VIDEO_A);
        expect(result.valid).toBe(false);
    });

    it("rejects a token with too many segments (extra dot)", () => {
        const token = signToken({ videoId: VIDEO_A, userId: USER_ID });
        const result = verifyToken(`${token}.extra`, VIDEO_A);
        expect(result.valid).toBe(false);
    });
});
