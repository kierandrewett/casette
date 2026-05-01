// Privacy decision tree for HLS endpoints.
//
// Called by every HLS route handler before serving any bytes. Throws
// HlsAccessError on denial so the route handler can return the right HTTP
// status without further boilerplate.

import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import type { Video } from "@/server/db/schema/videos";

import { verifyToken } from "./sign";

// ------------------------------------------------------------------
// Error type
// ------------------------------------------------------------------

export class HlsAccessError extends Error {
    public readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "HlsAccessError";
        this.status = status;
    }
}

// ------------------------------------------------------------------
// Result type
// ------------------------------------------------------------------

// The token to embed in rewritten playlist URIs (if any).
export type AccessResult = {
    token?: string;
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

// Constant-time comparison of two strings (avoid timing oracle on slug).
const safeStringEqual = (a: string, b: string): boolean => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) {
        // Lengths differ: still run a dummy compare to burn constant time, then
        // return false. This is best-effort; a truly adversarial attacker can
        // measure length from the request size, but the slug is long enough
        // that brute force is impractical anyway.
        timingSafeEqual(ab, ab);
        return false;
    }
    return timingSafeEqual(ab, bb);
};

// Extract a signed token from the request: ?t=<token> query param.
const extractToken = (req: NextRequest): string | null => {
    const t = req.nextUrl.searchParams.get("t");
    return t && t.length > 0 ? t : null;
};

// Extract an unlisted slug from the request: ?slug=<slug> query param.
const extractSlug = (req: NextRequest): string | null => {
    const s = req.nextUrl.searchParams.get("slug");
    return s && s.length > 0 ? s : null;
};

// ------------------------------------------------------------------
// Main guard
// ------------------------------------------------------------------

/**
 * Assert that the incoming request is permitted to access `video`.
 *
 * Decision tree:
 *   - video.status !== 'ready'  -> 404
 *   - public                    -> allow, no token needed
 *   - unlisted                  -> allow if ?slug= matches OR valid signed token
 *   - private                   -> require valid signed token; otherwise 401
 *
 * Returns `{ token? }` so callers can embed it in rewritten playlist URIs.
 * Throws `HlsAccessError` on denial.
 */
export const assertPlayableForRequest = (video: Video, req: NextRequest): AccessResult => {
    if (video.status !== "ready") {
        throw new HlsAccessError("video not found", 404);
    }

    if (video.privacy === "public") {
        return {};
    }

    if (video.privacy === "unlisted") {
        // A valid signed token is always sufficient (signed-in viewer).
        const rawToken = extractToken(req);
        if (rawToken) {
            const result = verifyToken(rawToken, video.id);
            if (result.valid) {
                return { token: rawToken };
            }
            // Fall through to slug check — don't reject on a bad token alone
            // for unlisted, since the slug alone is sufficient.
        }

        // Slug check.
        const slug = extractSlug(req);
        if (slug && video.unlistedSlug && safeStringEqual(slug, video.unlistedSlug)) {
            // Slug matched. No token issued — callers will embed ?slug= in URIs.
            return {};
        }

        throw new HlsAccessError("valid slug or token required for unlisted video", 401);
    }

    // private
    const rawToken = extractToken(req);
    if (!rawToken) {
        throw new HlsAccessError("signed token required for private video", 401);
    }
    const result = verifyToken(rawToken, video.id);
    if (!result.valid) {
        throw new HlsAccessError(`invalid token: ${result.reason}`, 401);
    }
    return { token: rawToken };
};
