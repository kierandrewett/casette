import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq, desc } from "drizzle-orm";

import AppShell from "@/components/shell/AppShell";
import { CreateChannelCard } from "@/components/studio/CreateChannelCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSession } from "@/lib/session";
import { db } from "@/server/db/client";
import { channels } from "@/server/db/schema/channels";

export const metadata: Metadata = { title: "Your channels" };

// Account / channels — list every channel the viewer owns and let them
// create another. This is the destination of the "+ New channel" link in
// the LeftRail and the matching entry in /studio.
const AccountChannelsPage = async () => {
    const session = await getSession();
    if (!session?.user) {
        redirect("/login?next=/account/channels");
    }

    const owned = await db
        .select({
            id: channels.id,
            handle: channels.handle,
            name: channels.name,
            avatarPath: channels.avatarPath,
            createdAt: channels.createdAt,
        })
        .from(channels)
        .where(eq(channels.ownerId, session.user.id))
        .orderBy(desc(channels.createdAt));

    return (
        <AppShell>
            <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight">Your channels</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {owned.length} {owned.length === 1 ? "channel" : "channels"}.
                    </p>
                </header>

                {owned.length > 0 && (
                    <ul className="mb-10 space-y-2">
                        {owned.map((channel) => (
                            <li
                                key={channel.id}
                                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                            >
                                <Avatar className="h-10 w-10">
                                    {channel.avatarPath && (
                                        <AvatarImage
                                            src={`/api/channel/${channel.id}/asset/avatar`}
                                            alt={channel.name}
                                        />
                                    )}
                                    <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{channel.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">@{channel.handle}</p>
                                </div>
                                <div className="flex shrink-0 gap-2 text-xs">
                                    <Link
                                        href={`/channel/${channel.handle}`}
                                        className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary"
                                    >
                                        View
                                    </Link>
                                    <Link
                                        href={`/studio/channel/${channel.handle}`}
                                        className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary"
                                    >
                                        Studio
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <h2 className="mb-3 text-lg font-semibold tracking-tight">
                    {owned.length === 0 ? "Create your first channel" : "Create another channel"}
                </h2>
                <CreateChannelCard />
            </div>
        </AppShell>
    );
};

export default AccountChannelsPage;
