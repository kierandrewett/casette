// Next.js calls register() once when the server boots. We use this hook to
// start the pg-boss worker exactly once per Node process. The worker boots
// in-process for v1; if we ever split it out, the only change is moving this
// hook into a standalone entrypoint.

export const register = async (): Promise<void> => {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const g = globalThis as unknown as { __CASSETTE_WORKER_BOOTED__?: boolean };
    if (g.__CASSETTE_WORKER_BOOTED__) return;
    g.__CASSETTE_WORKER_BOOTED__ = true;
    // Lazy-import so the rest of the bundle does not pull in pg-boss.
    const { registerWorker } = await import("@/worker/boot");
    await registerWorker();
};
