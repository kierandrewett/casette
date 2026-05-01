import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { HlsAccessError, assertPlayableForRequest } from "@/lib/hls/access";
import { hlsSpriteVttPath } from "@/lib/paths";
import { db } from "@/server/db/client";
import { videos } from "@/server/db/schema/videos";

export const runtime = "nodejs";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ videoId: string }> },
): Promise<NextResponse> {
    const { videoId } = await params;

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

    const filePath = hlsSpriteVttPath(videoId);

    let body: string;
    try {
        body = await readFile(filePath, "utf8");
    } catch {
        return new NextResponse("sprite vtt not found", { status: 404 });
    }

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": "text/vtt; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    });
}
