"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ShieldUserIcon, ArrowRight02Icon, CheckmarkCircle02Icon } from "hugeicons-react";

import { AssetUploader } from "@/components/studio/AssetUploader";
import { ChannelPreview } from "@/components/studio/ChannelPreview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { COUNTRY_OPTIONS, isKnownCountry } from "./countries";

interface ChannelCustomiseFormProps {
    channelId: string;
    handle: string;
    initialName: string;
    initialDescription: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    /** Currently pinned video id (channel trailer) — null when no trailer set. */
    initialPinnedVideoId: string | null;
    /** Whether new comments on this channel are held for moderation. */
    initialModerateComments: boolean;
    /** ISO 3166-1 alpha-2, or null when no country has been set. */
    initialCountry: string | null;
    /** Whether the public channel page lands on a Home tab. */
    initialHomeEnabled: boolean;
    /** Public+ready videos owned by this channel — pickable as a trailer. */
    eligibleTrailers: Array<{ id: string; title: string }>;
    /** Optional Storage & retention slot rendered inside the form column. */
    storageSlot?: React.ReactNode;
}

const inputClass =
    "block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

export const ChannelCustomiseForm = ({
    channelId,
    handle,
    initialName,
    initialDescription,
    avatarUrl: initialAvatarUrl,
    bannerUrl: initialBannerUrl,
    initialPinnedVideoId,
    initialModerateComments,
    initialCountry,
    initialHomeEnabled,
    eligibleTrailers,
    storageSlot,
}: ChannelCustomiseFormProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Form state. Tracked separately from "initial*" props so we can detect
    // a dirty form and only show the sticky save bar when there's something
    // to save.
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);
    const [pinnedVideoId, setPinnedVideoId] = useState<string | null>(initialPinnedVideoId);
    const [moderateComments, setModerateComments] = useState<boolean>(initialModerateComments);
    const [country, setCountry] = useState<string | null>(
        initialCountry && isKnownCountry(initialCountry) ? initialCountry.toUpperCase() : null,
    );
    const [homeEnabled, setHomeEnabled] = useState<boolean>(initialHomeEnabled);

    // Avatar / banner URLs are tracked so the preview pane reflects edits
    // immediately. The AssetUploader uploads/removes through its own REST
    // endpoint and reports the new URL via onUpdated.
    const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
    const [bannerUrl, setBannerUrl] = useState<string | null>(initialBannerUrl);

    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const utils = api.useUtils();

    const updateChannel = api.channel.update.useMutation({
        onSuccess: () => {
            setSaveSuccess(true);
            setSaveError(null);
            void utils.channel.byHandle.invalidate({ handle });
            startTransition(() => router.refresh());
        },
        onError: (err) => {
            setSaveError(err.message);
            setSaveSuccess(false);
        },
    });

    const handleAssetUpdated = (kind: "avatar" | "banner", url: string | null) => {
        if (kind === "avatar") setAvatarUrl(url);
        else setBannerUrl(url);
        void utils.channel.byHandle.invalidate({ handle });
        startTransition(() => router.refresh());
    };

    const isDirty = useMemo(() => {
        return (
            name.trim() !== initialName ||
            description.trim() !== initialDescription ||
            pinnedVideoId !== initialPinnedVideoId ||
            moderateComments !== initialModerateComments ||
            (country ?? null) !== (initialCountry?.toUpperCase() ?? null) ||
            homeEnabled !== initialHomeEnabled
        );
    }, [
        name,
        description,
        pinnedVideoId,
        moderateComments,
        country,
        homeEnabled,
        initialName,
        initialDescription,
        initialPinnedVideoId,
        initialModerateComments,
        initialCountry,
        initialHomeEnabled,
    ]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaveSuccess(false);
        setSaveError(null);
        updateChannel.mutate({
            channelId,
            name: name.trim(),
            description: description.trim(),
            pinnedVideoId,
            moderateComments,
            country,
            homeEnabled,
        });
    };

    const handleReset = () => {
        setName(initialName);
        setDescription(initialDescription);
        setPinnedVideoId(initialPinnedVideoId);
        setModerateComments(initialModerateComments);
        setCountry(initialCountry && isKnownCountry(initialCountry) ? initialCountry.toUpperCase() : null);
        setHomeEnabled(initialHomeEnabled);
        setSaveSuccess(false);
        setSaveError(null);
    };

    const isSaving = updateChannel.isPending || isPending;

    return (
        <form
            onSubmit={handleSave}
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]"
        >
            {/* --- Form column ------------------------------------------------ */}
            <div className="min-w-0 space-y-6 pb-24 lg:pb-6">
                {/* Branding ---------------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Branding</CardTitle>
                        <CardDescription>
                            The banner sits at the top of your channel page; the avatar appears in cards across the
                            site.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                        <AssetUploader
                            kind="banner"
                            channelId={channelId}
                            currentUrl={bannerUrl}
                            onUpdated={(url) => handleAssetUpdated("banner", url)}
                        />
                        <AssetUploader
                            kind="avatar"
                            channelId={channelId}
                            currentUrl={avatarUrl}
                            onUpdated={(url) => handleAssetUpdated("avatar", url)}
                        />
                    </CardContent>
                </Card>

                {/* Channel details --------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Channel details</CardTitle>
                        <CardDescription>
                            Public name, handle, location, and the long-form description shown on your About tab.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                            <div className="space-y-1.5">
                                <label htmlFor="channel-name" className="text-sm font-medium text-foreground">
                                    Name
                                </label>
                                <input
                                    id="channel-name"
                                    type="text"
                                    required
                                    minLength={1}
                                    maxLength={100}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isSaving}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="channel-handle" className="text-sm font-medium text-foreground">
                                    Handle
                                </label>
                                <input
                                    id="channel-handle"
                                    type="text"
                                    value={`@${handle}`}
                                    readOnly
                                    aria-readonly="true"
                                    className={cn(inputClass, "cursor-not-allowed text-muted-foreground")}
                                />
                                <p className="text-xs text-muted-foreground">Contact an admin to change your handle.</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="channel-description" className="text-sm font-medium text-foreground">
                                Description
                            </label>
                            <textarea
                                id="channel-description"
                                rows={6}
                                maxLength={2000}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isSaving}
                                placeholder="Tell visitors what your channel is about."
                                className={cn(inputClass, "resize-y")}
                            />
                            <p className="text-right text-xs text-muted-foreground">{description.length} / 2000</p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label htmlFor="channel-country" className="text-sm font-medium text-foreground">
                                    Country
                                </label>
                                <select
                                    id="channel-country"
                                    value={country ?? ""}
                                    onChange={(e) => setCountry(e.target.value || null)}
                                    disabled={isSaving}
                                    className={inputClass}
                                >
                                    <option value="">Not specified</option>
                                    {COUNTRY_OPTIONS.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">Surfaced on your About tab.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Landing tab</label>
                                <label className="flex h-[42px] items-center gap-3 rounded-lg border border-border bg-background px-3">
                                    <input
                                        type="checkbox"
                                        checked={homeEnabled}
                                        onChange={(e) => setHomeEnabled(e.target.checked)}
                                        disabled={isSaving}
                                        className="accent-primary"
                                    />
                                    <span className="text-sm text-foreground">Show a curated Home tab</span>
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    When off, viewers land on the Videos list.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Channel trailer --------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Channel trailer</CardTitle>
                        <CardDescription>
                            Pinned to the top of your Home tab as a hero card. Only public, ready videos can be
                            selected.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1.5">
                            <select
                                id="channel-trailer"
                                aria-label="Channel trailer"
                                value={pinnedVideoId ?? ""}
                                onChange={(e) => setPinnedVideoId(e.target.value || null)}
                                disabled={isSaving || eligibleTrailers.length === 0}
                                className={inputClass}
                            >
                                <option value="">No trailer</option>
                                {eligibleTrailers.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.title}
                                    </option>
                                ))}
                            </select>
                            {eligibleTrailers.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Publish a public, ready video to make it eligible as a trailer.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Moderation -------------------------------------------- */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Moderation</CardTitle>
                        <CardDescription>
                            Keep new comments out of public threads until you&apos;ve had a chance to review them.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 transition-colors has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                            <input
                                type="checkbox"
                                checked={moderateComments}
                                onChange={(e) => setModerateComments(e.target.checked)}
                                disabled={isSaving}
                                className="mt-1 accent-primary"
                            />
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">Hold new comments for review</p>
                                <p className="text-xs text-muted-foreground">
                                    New comments from non-channel viewers stay hidden until you approve them.
                                </p>
                            </div>
                        </label>

                        <Link
                            href={`/studio/channel/${handle}/moderation`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                            <ShieldUserIcon size={16} strokeWidth={1.8} />
                            Open moderation queue
                            <ArrowRight02Icon size={14} strokeWidth={1.8} />
                        </Link>
                    </CardContent>
                </Card>

                {/* Storage & retention (owner-only) ---------------------- */}
                {storageSlot}
            </div>

            {/* --- Preview column --------------------------------------------- */}
            <aside className="min-w-0 lg:sticky lg:top-32">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Channel preview
                </p>
                <ChannelPreview
                    handle={handle}
                    name={name}
                    description={description}
                    avatarUrl={avatarUrl}
                    bannerUrl={bannerUrl}
                    country={country}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                    Live preview of your public channel header. Save changes to publish.
                </p>
                <Link
                    href={`/channel/${handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    Open public page
                    <ArrowRight02Icon size={12} strokeWidth={1.8} />
                </Link>
            </aside>

            {/* --- Sticky save bar -------------------------------------------- */}
            {(isDirty || saveSuccess || saveError) && (
                <div
                    className={cn(
                        // Pinned to the bottom of the viewport, spanning the form column
                        // only on lg+ so it doesn't sit underneath the preview pane.
                        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:px-6 lg:px-8",
                        "lg:left-[var(--rail-width,16rem)]",
                    )}
                >
                    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                        <div className="min-w-0 text-sm">
                            {saveError ? (
                                <p className="truncate text-destructive">{saveError}</p>
                            ) : saveSuccess ? (
                                <p className="flex items-center gap-1.5 truncate text-foreground">
                                    <CheckmarkCircle02Icon size={16} strokeWidth={1.8} className="text-green-500" />
                                    Saved.
                                </p>
                            ) : (
                                <p className="truncate text-muted-foreground">You have unsaved changes.</p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                disabled={isSaving || !isDirty}
                            >
                                Discard
                            </Button>
                            <Button type="submit" size="sm" disabled={isSaving || !isDirty || name.trim().length === 0}>
                                {isSaving ? "Saving…" : "Save changes"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
};
