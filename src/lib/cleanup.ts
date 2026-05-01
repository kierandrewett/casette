import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { hlsDir, paths } from "@/lib/paths";

// Best-effort on-disk cleanup for a deleted video. Removes:
//   - MEDIA_SOURCE_PATH/<sourcePath> (the original file written by /api/upload)
//   - MEDIA_SOURCE_PATH/<channelHandle>/<videoId>.captions/ (sidecar caption dir)
//   - MEDIA_HLS_PATH/<videoId>/ (the whole HLS output, including segments,
//     captions, sprite, thumbnail)
//
// Failures are logged but not rethrown so a partial filesystem failure does
// not roll back the database delete. The operator can run a janitor pass
// later to sweep orphans.
export const cleanupVideoFiles = async (params: {
    videoId: string;
    sourcePath: string | null;
    channelHandle: string;
}): Promise<void> => {
    const { videoId, sourcePath, channelHandle } = params;

    const targets: string[] = [];

    if (sourcePath) {
        targets.push(join(paths.sourceRoot, sourcePath));
        // The source file lives next to its captions sidecar dir.
        const captionsDir = join(dirname(join(paths.sourceRoot, sourcePath)), `${videoId}.captions`);
        targets.push(captionsDir);
    } else {
        // Even without a sourcePath, attempt the conventional layout.
        targets.push(join(paths.sourceRoot, channelHandle, `${videoId}`));
        targets.push(join(paths.sourceRoot, channelHandle, `${videoId}.captions`));
    }

    targets.push(hlsDir(videoId));

    for (const target of targets) {
        try {
            await rm(target, { recursive: true, force: true });
        } catch (err) {
            console.warn(`[cleanup] failed to remove ${target}:`, err);
        }
    }
};
