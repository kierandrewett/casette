import { and, desc, eq } from "drizzle-orm";

import { getSession } from "@/lib/session";
import { db } from "@/server/db/client";
import { channels } from "@/server/db/schema";
import { adminGrants } from "@/server/db/schema/admin";
import { subscriptions } from "@/server/db/schema/social";

import { AppHeader, type AppHeaderUser } from "./AppHeader";
import type { UserChannel } from "./LeftRail";
import { MobileNav } from "./MobileNav";
import { SidebarFrame } from "./SidebarFrame";

interface AppShellProps {
    children: React.ReactNode;
    /**
     * When true, the LeftRail is omitted and the main content uses the full
     * viewport width. Used by /watch where the player wants the horizontal
     * real estate and the rail is just noise.
     */
    hideSidebar?: boolean;
}

// Server component: fetches session + user channels + subscriptions, then
// renders the header and a client SidebarFrame that drives rail visibility
// from the shared store. The left rail CSS variable widths are in globals.css.
const AppShell = async ({ children, hideSidebar = false }: AppShellProps) => {
    const session = await getSession();

    let user: AppHeaderUser | null = null;
    let userChannels: UserChannel[] = [];
    let userSubscriptions: UserChannel[] = [];
    let isAdmin = false;

    if (session?.user) {
        user = {
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? null,
        };

        const [channelRows, subscriptionRows, adminRows] = await Promise.all([
            db
                .select({
                    id: channels.id,
                    handle: channels.handle,
                    name: channels.name,
                    avatarPath: channels.avatarPath,
                })
                .from(channels)
                .where(eq(channels.ownerId, session.user.id))
                .orderBy(desc(channels.createdAt)),
            db
                .select({
                    id: channels.id,
                    handle: channels.handle,
                    name: channels.name,
                    avatarPath: channels.avatarPath,
                })
                .from(subscriptions)
                .innerJoin(channels, eq(channels.id, subscriptions.channelId))
                .where(eq(subscriptions.userId, session.user.id))
                .orderBy(desc(subscriptions.createdAt))
                .limit(50),
            db
                .select({ userId: adminGrants.userId })
                .from(adminGrants)
                .where(and(eq(adminGrants.userId, session.user.id)))
                .limit(1),
        ]);
        userChannels = channelRows;
        userSubscriptions = subscriptionRows;
        isAdmin = !!adminRows[0];
    }

    return (
        <div className="min-h-full">
            <AppHeader user={user} isAdmin={isAdmin} />

            <SidebarFrame
                channels={userChannels}
                subscriptions={userSubscriptions}
                isAdmin={isAdmin}
                isAuthenticated={!!user}
                forceHidden={hideSidebar}
            >
                <div className="pt-14">{children}</div>
            </SidebarFrame>

            <MobileNav />
        </div>
    );
};

export default AppShell;
