import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserMultipleIcon } from "hugeicons-react";

import { CreateChannelCard } from "@/components/studio/CreateChannelCard";
import { StudioEmptyState } from "@/components/studio/StudioEmptyState";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioSubNav, type StudioChannel } from "@/components/studio/StudioSubNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc/server";

export const metadata: Metadata = {
    title: "Studio",
};

const initialsOf = (name: string): string => name.slice(0, 2).toUpperCase();

const StudioPage = async () => {
    let memberships: Awaited<ReturnType<typeof trpc.channel.listMine>>;
    try {
        memberships = await trpc.channel.listMine();
    } catch {
        redirect("/login");
    }

    const channels: StudioChannel[] = memberships.map((c) => ({
        id: c.id,
        handle: c.handle,
        name: c.name,
        avatarPath: c.avatarPath,
    }));

    return (
        <>
            <StudioSubNav channels={channels} />

            <div className="mx-auto max-w-7xl pt-6 md:pt-8">
                <StudioPageHeader
                    title="Studio"
                    description="Manage your channels, uploads, and analytics in one place."
                    actions={
                        <Link
                            href="/account/channels"
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
                        >
                            New channel
                        </Link>
                    }
                />

                {memberships.length === 0 ? (
                    <StudioEmptyState
                        icon={UserMultipleIcon}
                        title="No channels yet"
                        description="Create a channel to start uploading videos and customise your public page."
                    />
                ) : (
                    <section className="space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Your channels
                        </h2>
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {memberships.map((channel) => {
                                const avatarUrl = channel.avatarPath ? `/api/channel/${channel.id}/asset/avatar` : null;
                                return (
                                    <li key={channel.id}>
                                        <Link
                                            href={`/studio/channel/${channel.handle}`}
                                            className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                                        >
                                            <Avatar className="h-12 w-12">
                                                {avatarUrl && <AvatarImage src={avatarUrl} alt={channel.name} />}
                                                <AvatarFallback className="text-sm font-semibold uppercase">
                                                    {initialsOf(channel.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">{channel.name}</p>
                                                <p className="truncate text-sm text-muted-foreground">
                                                    @{channel.handle}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-muted-foreground">
                                                {channel.role}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Inline CreateChannelCard tucked at the bottom for users
                            who want to start another channel without leaving Studio. */}
                        <div className="pt-2">
                            <CreateChannelCard />
                        </div>
                    </section>
                )}
            </div>
        </>
    );
};

export default StudioPage;
