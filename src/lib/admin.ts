import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getSession } from "@/lib/session";
import { db } from "@/server/db/client";
import { adminGrants } from "@/server/db/schema/admin";

/**
 * Server-side admin guard for RSC pages.
 *
 * Loads the session via the React-cached helper (so multiple admin pages and
 * any nested AppShell render share one lookup) and verifies the user has a
 * row in `admin_grants`. Redirects to `/` for unauthenticated callers or
 * non-admins. Returns the session user.
 *
 * The legacy `headers` parameter is accepted but ignored — older callers
 * passed `await headers()`, which the cached helper resolves itself.
 */
export const requireAdmin = async (_headers?: Headers) => {
    const session = await getSession().catch(() => null);
    if (!session?.user) {
        redirect("/");
    }

    const rows = await db
        .select({ userId: adminGrants.userId })
        .from(adminGrants)
        .where(eq(adminGrants.userId, session.user.id))
        .limit(1);

    if (!rows[0]) {
        redirect("/");
    }

    return session.user;
};
