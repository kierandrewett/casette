import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { ChannelCustomiseForm } from "@/components/studio/ChannelCustomiseForm";
import { QuotaPanel } from "@/components/studio/QuotaPanel";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/server";
import { db } from "@/server/db/client";
import { channels as channelsTable } from "@/server/db/schema/channels";
import { videos } from "@/server/db/schema/videos";

type Props = {
    params: Promise<{ handle: string }>;
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
    const { handle } = await params;
    return { title: `@${handle} — Customise channel` };
};

const CustomiseChannelPage = async ({ params }: Props) => {
    const { handle } = await params;

    // Require auth.
    let channels: Awaited<ReturnType<typeof trpc.channel.listMine>>;
    try {
        channels = await trpc.channel.listMine();
    } catch {
        redirect("/login");
    }

    const membership = channels.find((c) => c.handle === handle.toLowerCase());
    if (!membership) {
        notFound();
    }

    // Fetch full channel row (includes avatarPath / bannerPath).
    let channel: Awaited<ReturnType<typeof trpc.channel.byHandle>>;
    try {
        channel = await trpc.channel.byHandle({ handle: handle.toLowerCase() });
    } catch {
        notFound();
    }

    // Only owner / manager may access customisation.
    if (membership.role !== "owner" && membership.role !== "manager") {
        notFound();
    }

    const avatarUrl = channel.avatarPath ? `/api/channel/${channel.id}/asset/avatar` : null;
    const bannerUrl = channel.bannerPath ? `/api/channel/${channel.id}/asset/banner` : null;

    // Channel-trailer + moderation flag + country + homeEnabled come from the
    // row directly (the public byHandle procedure intentionally omits them).
    const extraRows = await db
        .select({
            pinnedVideoId: channelsTable.pinnedVideoId,
            moderateComments: channelsTable.moderateComments,
            country: channelsTable.country,
            homeEnabled: channelsTable.homeEnabled,
        })
        .from(channelsTable)
        .where(eq(channelsTable.id, channel.id))
        .limit(1);
    const extra = extraRows[0] ?? {
        pinnedVideoId: null,
        moderateComments: false,
        country: null,
        homeEnabled: false,
    };

    // Eligible trailers: this channel's public+ready+non-draft videos. Cap
    // at the 50 most recent so the dropdown stays reasonable.
    const eligibleTrailers = await db
        .select({ id: videos.id, title: videos.title })
        .from(videos)
        .where(
            and(
                eq(videos.channelId, channel.id),
                eq(videos.privacy, "public"),
                eq(videos.status, "ready"),
                eq(videos.isDraft, false),
            ),
        )
        .orderBy(desc(videos.publishedAt))
        .limit(50)
        .catch(() => []);

    // Load usage / quota data (best-effort).
    let usageData: { used: number; quota: number | null; autoPruneDays: number | null } | null = null;
    if (membership.role === "owner") {
        try {
            usageData = await trpc.channel.getUsage({ channelId: channel.id });
        } catch {
            // Best-effort; silently skip the panel if the call fails.
        }
    }

    const storageSlot =
        membership.role === "owner" && usageData ? (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Storage &amp; retention</CardTitle>
                    <CardDescription>
                        Optional disk quota and auto-prune window. Auto-prune runs nightly; raw sources older than the
                        threshold are removed while HLS variants and metadata stay.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <QuotaPanel
                        channelId={channel.id}
                        initialUsed={usageData.used}
                        initialQuota={usageData.quota}
                        initialAutoPruneDays={usageData.autoPruneDays}
                    />
                </CardContent>
            </Card>
        ) : null;

    return (
        <>
            <StudioPageHeader
                title="Customise channel"
                description="Update branding, channel details, the trailer pinned to your home tab, moderation, and storage. Edits are previewed live on the right."
            />

            <ChannelCustomiseForm
                channelId={channel.id}
                handle={channel.handle}
                initialName={channel.name}
                initialDescription={channel.description}
                avatarUrl={avatarUrl}
                bannerUrl={bannerUrl}
                initialPinnedVideoId={extra.pinnedVideoId ?? null}
                initialModerateComments={!!extra.moderateComments}
                initialCountry={extra.country ?? null}
                initialHomeEnabled={!!extra.homeEnabled}
                eligibleTrailers={eligibleTrailers}
                storageSlot={storageSlot}
            />
        </>
    );
};

export default CustomiseChannelPage;
