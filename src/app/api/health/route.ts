import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/health is a small REST liveness/readiness endpoint for orchestrators
// that do not speak tRPC. It checks:
//   - the DB is reachable (SELECT 1)
//   - the worker globals are populated (so we know pg-boss has booted)
//
// We intentionally keep this fast (no external HTTP, no recursive checks)
// and side-effect-free.

const startTime = Date.now();

export async function GET(): Promise<Response> {
    const checks: Record<string, "ok" | string> = {};
    let overallOk = true;

    // DB ping
    try {
        await db.execute(sql`select 1`);
        checks["db"] = "ok";
    } catch (err) {
        overallOk = false;
        checks["db"] = err instanceof Error ? err.message : "error";
    }

    // Worker boot probe (best-effort; not every endpoint needs the worker).
    const workerGlobal = globalThis as unknown as { __CASSETTE_PG_BOSS__?: unknown };
    checks["worker"] = workerGlobal.__CASSETTE_PG_BOSS__ ? "ok" : "not booted";

    return new Response(
        JSON.stringify({
            ok: overallOk,
            uptimeSec: Math.floor((Date.now() - startTime) / 1000),
            checks,
            ts: new Date().toISOString(),
        }),
        {
            status: overallOk ? 200 : 503,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
            },
        },
    );
}
