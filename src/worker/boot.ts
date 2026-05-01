import PgBoss from "pg-boss";

import { env } from "@/env";

import { transcodeHandler, type TranscodePayload } from "./jobs/transcode";

// Idempotent guard: pg-boss must only be started once per process.
// The instrumentation.ts hook also has a guard, but this one protects against
// direct imports in dev HMR scenarios.
const g = globalThis as unknown as { __VIDEO_WORKER_BOOTED__?: boolean };

let boss: PgBoss | null = null;

// registerWorker is called from instrumentation.ts on server boot.
// It is a no-op if the worker has already been registered in this process.
export const registerWorker = async (): Promise<void> => {
    if (g.__VIDEO_WORKER_BOOTED__) return;
    g.__VIDEO_WORKER_BOOTED__ = true;

    boss = new PgBoss({
        connectionString: env.DATABASE_URL,
        schema: "pgboss",
        // Retain completed jobs for 24 h so the studio can display history.
        archiveCompletedAfterSeconds: 60 * 60 * 24,
        deleteAfterSeconds: 60 * 60 * 24 * 7,
    });

    boss.on("error", (err) => {
        console.error("[worker] pg-boss error:", err);
    });

    await boss.start();

    // batchSize = TRANSCODE_CONCURRENCY: pg-boss v10 fetches up to batchSize
    // jobs at once and calls the handler with the batch. The handler is wired
    // to process one at a time (see the job handler signature), matching the
    // v9 teamSize/teamConcurrency contract described in PLAN §6.
    await boss.work<TranscodePayload>(
        "transcode-video",
        { batchSize: env.TRANSCODE_CONCURRENCY },
        transcodeHandler,
    );

    console.log(
        `[worker] pg-boss started; registered transcode-video worker (teamSize=${env.TRANSCODE_CONCURRENCY})`,
    );
};

// Expose boss for the upload route to enqueue jobs.
// Returns null before registerWorker() has been called (e.g. during cold-start
// race). Callers should handle this gracefully.
export const getBoss = (): PgBoss | null => boss;
