import { z } from "zod";

const serverSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(16),
    BETTER_AUTH_URL: z.string().url().optional(),
    PUBLIC_URL: z.string().url(),
    HLS_SIGNING_SECRET: z.string().min(16),
    MEDIA_SOURCE_PATH: z.string().min(1),
    MEDIA_HLS_PATH: z.string().min(1),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(21474836480),
    TRANSCODE_CONCURRENCY: z.coerce.number().int().positive().default(1),
    // z.coerce.boolean() trips up on "0" (every non-empty string is truthy in
    // JavaScript). Parse explicitly so ENABLE_NVENC="0" actually means off.
    ENABLE_NVENC: z
        .preprocess(
            (v) => (typeof v === "string" ? ["1", "true", "yes", "on"].includes(v.toLowerCase()) : v),
            z.boolean(),
        )
        .default(false),
    // ADMIN_EMAIL is a bootstrap convenience for the first-run admin seed; it
    // bypasses Better-Auth's signup flow and is allowed to be a local-only
    // address like "admin@local" so first boot works on a fresh box.
    ADMIN_EMAIL: z.string().min(3).optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    // SMTP_URL is optional. When set, transactional email (e.g. password reset)
    // is delivered via nodemailer. Format: smtp[s]://user:pass@host:port
    // When absent, the would-be-sent payload is logged at info level so an
    // operator can copy-paste the reset URL from `docker compose logs`.
    SMTP_URL: z.string().url().optional(),
    // MAIL_FROM is the sender address used in transactional email.
    MAIL_FROM: z.string().email().optional(),
    // METRICS_TOKEN optionally gates the /api/metrics Prometheus endpoint.
    // When set, requests must supply `Authorization: Bearer <token>`.
    // When absent, the endpoint is open (suitable for a private network).
    METRICS_TOKEN: z.string().optional(),
    // Whisper auto-captions. Two paths:
    //   - WHISPER_BINARY_PATH + WHISPER_MODEL_PATH for whisper.cpp on the host.
    //   - WHISPER_API_URL (+ WHISPER_API_KEY) for an external Whisper-
    //     compatible HTTP endpoint.
    // Worker prefers the binary when both are set.
    WHISPER_BINARY_PATH: z.string().optional(),
    WHISPER_MODEL_PATH: z.string().optional(),
    WHISPER_API_URL: z.string().url().optional(),
    WHISPER_API_KEY: z.string().optional(),
    // When true, fan out a transcribe-video job after every successful
    // transcode. Otherwise transcription is admin-triggered only.
    WHISPER_AUTO: z
        .preprocess(
            (v) => (typeof v === "string" ? ["1", "true", "yes", "on"].includes(v.toLowerCase()) : v),
            z.boolean(),
        )
        .default(false),
    // Optional Sentry DSN for error monitoring. When absent, error-monitoring.ts
    // is a no-op and @sentry/nextjs does not need to be installed.
    SENTRY_DSN: z.string().optional(),
});

const clientSchema = z.object({
    NEXT_PUBLIC_PUBLIC_URL: z.string().url().optional(),
});

const parsed = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    PUBLIC_URL: process.env.PUBLIC_URL,
    HLS_SIGNING_SECRET: process.env.HLS_SIGNING_SECRET,
    MEDIA_SOURCE_PATH: process.env.MEDIA_SOURCE_PATH,
    MEDIA_HLS_PATH: process.env.MEDIA_HLS_PATH,
    MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
    TRANSCODE_CONCURRENCY: process.env.TRANSCODE_CONCURRENCY,
    ENABLE_NVENC: process.env.ENABLE_NVENC,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SMTP_URL: process.env.SMTP_URL,
    MAIL_FROM: process.env.MAIL_FROM,
    METRICS_TOKEN: process.env.METRICS_TOKEN,
    WHISPER_BINARY_PATH: process.env.WHISPER_BINARY_PATH,
    WHISPER_MODEL_PATH: process.env.WHISPER_MODEL_PATH,
    WHISPER_API_URL: process.env.WHISPER_API_URL,
    WHISPER_API_KEY: process.env.WHISPER_API_KEY,
    WHISPER_AUTO: process.env.WHISPER_AUTO,
    SENTRY_DSN: process.env.SENTRY_DSN,
});

if (!parsed.success) {
    // Print human-readable validation errors and crash early so misconfigured
    // deploys never silently come up with broken behaviour.
    console.error("[env] invalid environment configuration:");
    for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Invalid environment configuration. See logs above.");
}

const clientParsed = clientSchema.parse({
    NEXT_PUBLIC_PUBLIC_URL: process.env.NEXT_PUBLIC_PUBLIC_URL ?? parsed.data.PUBLIC_URL,
});

export const env = {
    ...parsed.data,
    ...clientParsed,
} as const;

export type Env = typeof env;
