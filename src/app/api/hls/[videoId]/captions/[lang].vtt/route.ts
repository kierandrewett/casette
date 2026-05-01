import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { HlsAccessError, assertPlayableForRequest } from "@/lib/hls/access";
import { hlsCaptionsPath } from "@/lib/paths";
import { db } from "@/server/db/client";
import { videos } from "@/server/db/schema/videos";

export const runtime = "nodejs";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ videoId: string; lang: string }> },
): Promise<NextResponse> {
    // Next.js strips the .vtt suffix from `[lang].vtt` segments, giving us just
    // the BCP-47 language tag (e.g. "en", "en-GB"). The actual file on disk
    // still has the .vtt extension because hlsCaptionsPath appends it.
    const { videoId, lang } = await params;

    // Load video row.
    const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const video = rows[0];

    if (!video) {
        return new NextResponse("not found", { status: 404 });
    }

    // Privacy guard.
    try {
        assertPlayableForRequest(video, req);
    } catch (err) {
        if (err instanceof HlsAccessError) {
            return new NextResponse(err.message, { status: err.status });
        }
        throw err;
    }

    const filePath = hlsCaptionsPath(videoId, lang);

    let body: string;
    try {
        body = await readFile(filePath, "utf8");
    } catch {
        return new NextResponse("captions not found", { status: 404 });
    }

    const isPublic = video.privacy === "public";
    const cacheControl = isPublic ? "public, max-age=300" : "no-store";

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": "text/vtt; charset=utf-8",
            "Cache-Control": cacheControl,
        },
    });
}
