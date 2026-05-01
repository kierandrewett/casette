import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { videos } from "./videos";

// Mirror of pg-boss job state for the Studio UI. pg-boss owns its own
// `pgboss.*` schema; we duplicate just enough so feature code never has to
// reach into pgboss tables.
export const transcodeJobState = pgEnum("transcode_job_state", ["queued", "running", "completed", "failed"]);

export const transcodeJobs = pgTable(
    "transcode_jobs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        videoId: uuid("video_id")
            .notNull()
            .references(() => videos.id, { onDelete: "cascade" }),
        pgbossJobId: text("pgboss_job_id"),
        state: transcodeJobState("state").notNull().default("queued"),
        progress: integer("progress").notNull().default(0),
        step: text("step"),
        message: text("message"),
        startedAt: timestamp("started_at", { withTimezone: true }),
        finishedAt: timestamp("finished_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
        videoIdx: index("transcode_jobs_video_idx").on(t.videoId, t.createdAt.desc()),
        stateIdx: index("transcode_jobs_state_idx").on(t.state),
    }),
);

export type TranscodeJob = typeof transcodeJobs.$inferSelect;
export type TranscodeJobState = (typeof transcodeJobState.enumValues)[number];
