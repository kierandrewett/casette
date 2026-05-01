// tRPC router for account-level operations: session listing and revocation.
// Password management goes via the Better-Auth client directly (change password,
// forgot password), but session data is most efficient to serve from tRPC since
// we need the full Drizzle row set with a currentSession flag injected.

import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { session as sessionTable } from "@/server/db/schema/auth";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const accountRouter = createTRPCRouter({
    // Return all active sessions for the caller, ordered newest-first.
    // Includes a `currentSession` flag for the session making this request.
    listSessions: protectedProcedure.query(async ({ ctx }) => {
        const rows = await ctx.db
            .select()
            .from(sessionTable)
            .where(eq(sessionTable.userId, ctx.user.id))
            .orderBy(desc(sessionTable.createdAt));

        const currentSessionId = ctx.session.session.id;
        return rows.map((row) => ({
            id: row.id,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            ipAddress: row.ipAddress,
            userAgent: row.userAgent,
            currentSession: row.id === currentSessionId,
        }));
    }),

    // Revoke a specific session. Refuses to revoke the caller's current session.
    revokeSession: protectedProcedure
        .input(z.object({ sessionId: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            if (input.sessionId === ctx.session.session.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Cannot revoke your current session. Sign out instead.",
                });
            }

            const deleted = await ctx.db
                .delete(sessionTable)
                .where(
                    and(
                        eq(sessionTable.id, input.sessionId),
                        eq(sessionTable.userId, ctx.user.id),
                    ),
                )
                .returning({ id: sessionTable.id });

            if (!deleted[0]) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
            }

            return { revoked: true };
        }),

    // Revoke every session for the caller except the current one.
    revokeAllOtherSessions: protectedProcedure.mutation(async ({ ctx }) => {
        await ctx.db
            .delete(sessionTable)
            .where(
                and(
                    eq(sessionTable.userId, ctx.user.id),
                    ne(sessionTable.id, ctx.session.session.id),
                ),
            );

        return { revoked: true };
    }),
});
