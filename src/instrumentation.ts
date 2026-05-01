// Next.js calls register() once when the server boots. We use this hook to
// start the pg-boss worker exactly once per Node process. registerWorker()
// itself owns the idempotency on globalThis so we do not duplicate the gate
// here.
//
// Skip on the edge runtime: pg-boss is Node-only.

export const register = async (): Promise<void> => {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    // Lazy-import so the rest of the bundle does not pull in pg-boss.
    const { registerWorker } = await import("@/worker/boot");
    await registerWorker();
};
