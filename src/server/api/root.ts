import { createCallerFactory, createTRPCRouter, publicProcedure } from "./trpc";

// The application router. Sub-routers are added by the per-milestone agents
// (channel, video, comment, subscription, like, playlist, history, search,
// notification). Until they land, only `health.ping` exists so the wire shape
// is real.

export const appRouter = createTRPCRouter({
    health: createTRPCRouter({
        ping: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),
    }),
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
