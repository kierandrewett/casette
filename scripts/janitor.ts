// scripts/janitor.ts
//
// Sweep on-disk media for orphans whose database row has been deleted.
//
// Two passes:
//
//   1. MEDIA_HLS_PATH:    every immediate subdirectory whose name is a UUID
//                          should match a row in `videos`. Any UUID dir
//                          without a matching row is removed. The `_assets`
//                          dir is kept; we cross-check the channel ids
//                          inside it against the `channels` table.
//
//   2. MEDIA_SOURCE_PATH:  every file directly under a channel handle dir
//                          should match a `videos` row whose `sourcePath`
//                          column points at it. Anything else is removed.
//
// All filesystem operations are dry-run by default; pass --apply to actually
// delete. The output prints a summary so the operator can re-run with
// confidence.

import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";

import { config as loadDotenv } from "../src/lib/load-env";

loadDotenv();

const apply = process.argv.includes("--apply");

const log = (msg: string): void => console.log(`[janitor] ${msg}`);

const isUuid = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const main = async (): Promise<void> => {
    // Lazy-import so the migration journal does not have to exist when
    // running the janitor against a freshly-restored DB.
    const { db } = await import("../src/server/db/client");
    const { videos } = await import("../src/server/db/schema/videos");
    const { channels } = await import("../src/server/db/schema/channels");
    const { paths } = await import("../src/lib/paths");

    log(`apply=${apply}`);

    // ----- pass 1: MEDIA_HLS_PATH -----
    let hlsRemoved = 0;
    let hlsKept = 0;
    try {
        const entries = await readdir(paths.hlsRoot, { withFileTypes: true });
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (e.name === "_assets") continue;
            if (!isUuid(e.name)) {
                log(`skip non-uuid hls entry: ${e.name}`);
                continue;
            }
            const rows = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, e.name)).limit(1);
            const exists = rows[0] !== undefined;
            if (exists) {
                hlsKept += 1;
            } else {
                hlsRemoved += 1;
                const target = join(paths.hlsRoot, e.name);
                log(`orphan hls dir: ${target}`);
                if (apply) await rm(target, { recursive: true, force: true });
            }
        }
    } catch (err) {
        log(`hls pass: cannot read ${paths.hlsRoot}: ${(err as Error).message}`);
    }

    // ----- pass 2: MEDIA_HLS_PATH/_assets -----
    let assetsRemoved = 0;
    try {
        const assetsRoot = join(paths.hlsRoot, "_assets");
        const channelDirs = await readdir(assetsRoot, { withFileTypes: true }).catch(() => []);
        for (const e of channelDirs) {
            if (!e.isDirectory()) continue;
            if (!isUuid(e.name)) continue;
            const rows = await db
                .select({ id: channels.id })
                .from(channels)
                .where(eq(channels.id, e.name))
                .limit(1);
            if (!rows[0]) {
                assetsRemoved += 1;
                const target = join(assetsRoot, e.name);
                log(`orphan asset dir: ${target}`);
                if (apply) await rm(target, { recursive: true, force: true });
            }
        }
    } catch {
        // _assets may not exist on a fresh stack.
    }

    // ----- pass 3: MEDIA_SOURCE_PATH/<channelHandle>/<videoId>.<ext> -----
    let sourceRemoved = 0;
    let sourceKept = 0;
    try {
        const channelDirs = await readdir(paths.sourceRoot, { withFileTypes: true });
        for (const cd of channelDirs) {
            if (!cd.isDirectory()) continue;
            if (cd.name === ".tmp") continue;
            const dir = join(paths.sourceRoot, cd.name);
            const files = await readdir(dir, { withFileTypes: true });
            for (const f of files) {
                if (!f.isFile()) continue;
                // Filename pattern is `<videoId>.<ext>`; if the basename
                // (UUID part) does not match a video row we drop the file.
                const base = f.name.replace(/\.[^.]+$/, "");
                if (!isUuid(base)) {
                    log(`skip non-uuid source file: ${join(dir, f.name)}`);
                    continue;
                }
                const rows = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, base)).limit(1);
                if (rows[0]) {
                    sourceKept += 1;
                } else {
                    sourceRemoved += 1;
                    const target = join(dir, f.name);
                    log(`orphan source file: ${target}`);
                    if (apply) await rm(target, { force: true });
                }
            }

            // Also sweep the `<videoId>.captions` sidecar dirs.
            const subDirs = files.filter((x) => x.isDirectory() && /\.captions$/.test(x.name));
            for (const sd of subDirs) {
                const base = sd.name.replace(/\.captions$/, "");
                if (!isUuid(base)) continue;
                const rows = await db.select({ id: videos.id }).from(videos).where(eq(videos.id, base)).limit(1);
                if (!rows[0]) {
                    sourceRemoved += 1;
                    const target = join(dir, sd.name);
                    log(`orphan captions sidecar: ${target}`);
                    if (apply) await rm(target, { recursive: true, force: true });
                }
            }
        }
    } catch (err) {
        log(`source pass: cannot read ${paths.sourceRoot}: ${(err as Error).message}`);
    }

    const summary = [
        `hls kept=${hlsKept} removed=${hlsRemoved}`,
        `assets removed=${assetsRemoved}`,
        `source kept=${sourceKept} removed=${sourceRemoved}`,
    ].join("; ");
    log(summary);
    log(apply ? "done (applied)" : "done (dry run; pass --apply to execute)");
};

// stat is intentionally imported but unused; future passes may want it.
void stat;

main().catch((err) => {
    console.error("[janitor] failed:", err);
    process.exit(1);
});
