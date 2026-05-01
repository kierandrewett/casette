// Worker boot stub. The transcoding handler is added by M3 (upload + transcode).
// For now, the function exists so instrumentation.ts can import it without
// crashing the server boot.

export const registerWorker = async (): Promise<void> => {
    // pg-boss + transcoding handlers land in M3. Until then, this is a no-op
    // so the dev server boots cleanly.
    if (process.env.CASSETTE_WORKER_DEBUG === "1") {
        console.log("[worker] boot stub: nothing to do until M3 lands the transcode handler");
    }
};
