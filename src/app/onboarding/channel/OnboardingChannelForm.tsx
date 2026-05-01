"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { gravatarUrlFromHash } from "@/lib/gravatar";
import { isValidHandle } from "@/lib/slug";
import { api } from "@/lib/trpc/client";

interface Props {
    /** User's display name from sign-up — defaults the channel name. */
    defaultName: string;
    /** Pre-computed libravatar md5 hash; lets us preview without sending the
     *  raw email back to the client. */
    avatarHash: string;
}

// Slugify a free-form display name into a candidate channel handle. Lowercase
// alpha-num, replace runs of non-handle chars with a single hyphen, trim
// leading/trailing hyphens, cap at 30 chars.
const slugify = (input: string): string =>
    input
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30);

export const OnboardingChannelForm = ({ defaultName, avatarHash }: Props) => {
    const router = useRouter();

    const [name, setName] = useState(defaultName);
    const [handle, setHandle] = useState(slugify(defaultName));
    // Track whether the user has manually edited the handle. Until then we
    // mirror name -> handle so a small typo at the start doesn't desync them.
    const [handleEdited, setHandleEdited] = useState(false);
    const [about, setAbout] = useState("");
    const [useLibravatar, setUseLibravatar] = useState(true);
    const [avatarAvailable, setAvatarAvailable] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    // Preview check: if libravatar 404s for the hash we still let the toggle
    // exist but flip it off and disable. Server will redo this check before
    // doing anything irreversible.
    useEffect(() => {
        let cancelled = false;
        const url = gravatarUrlFromHash(avatarHash, 256);
        const img = new Image();
        img.onload = () => !cancelled && setAvatarAvailable(true);
        img.onerror = () => {
            if (cancelled) return;
            setAvatarAvailable(false);
            setUseLibravatar(false);
        };
        img.src = url;
        return () => {
            cancelled = true;
        };
    }, [avatarHash]);

    const onNameChange = (v: string) => {
        setName(v);
        if (!handleEdited) setHandle(slugify(v));
    };

    const onHandleChange = (v: string) => {
        setHandle(v.toLowerCase().slice(0, 30));
        setHandleEdited(true);
    };

    const createChannel = api.channel.create.useMutation();

    const handleValid = isValidHandle(handle);
    const canSubmit = !busy && handleValid && name.trim().length > 0;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        try {
            const channel = await createChannel.mutateAsync({
                handle,
                name: name.trim(),
                description: about.trim(),
            });

            // Optional: fetch the libravatar PNG and POST it through the
            // existing channel-asset endpoint. Best-effort — failing to
            // upload the avatar should not abort onboarding.
            if (useLibravatar && avatarAvailable) {
                try {
                    const url = gravatarUrlFromHash(avatarHash, 512);
                    const res = await fetch(url);
                    if (res.ok) {
                        const blob = await res.blob();
                        const fd = new FormData();
                        fd.append("kind", "avatar");
                        // Libravatar returns image/jpeg by default; the asset
                        // route validates by magic bytes regardless of the
                        // filename so any reasonable extension works.
                        fd.append("file", blob, "libravatar.jpg");
                        await fetch(`/api/channel/${channel.id}/asset`, {
                            method: "POST",
                            body: fd,
                        });
                    }
                } catch {
                    // Swallow — the user can upload a real avatar later.
                }
            }

            toast.success("Channel ready");
            router.push("/");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create channel");
            setBusy(false);
        }
    };

    return (
        <form
            onSubmit={submit}
            className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
            <div className="space-y-1.5">
                <Label htmlFor="name">Channel name</Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    maxLength={100}
                    autoFocus
                    placeholder="Your channel name"
                />
                <p className="text-xs text-muted-foreground">Defaults to your account name; change if you'd like.</p>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="handle">Handle</Label>
                <div className="flex items-center">
                    <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                        @
                    </span>
                    <Input
                        id="handle"
                        value={handle}
                        onChange={(e) => onHandleChange(e.target.value)}
                        maxLength={30}
                        className="rounded-l-none"
                        placeholder="mychannel"
                    />
                </div>
                <p className="text-xs text-muted-foreground">
                    {handleValid
                        ? `Your channel will live at /channel/${handle}.`
                        : "3–30 characters, lowercase letters/digits/hyphens/underscores."}
                </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <span className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm text-muted-foreground">
                    {avatarAvailable && useLibravatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={gravatarUrlFromHash(avatarHash, 96)}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        name.slice(0, 2).toUpperCase() || "??"
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <Label htmlFor="libravatar" className="text-sm">
                        Use libravatar avatar
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        {avatarAvailable === false
                            ? "No libravatar found for this email — you can upload one later."
                            : "Pulls your existing libravatar/gravatar image as the channel avatar."}
                    </p>
                </div>
                <Switch
                    id="libravatar"
                    checked={useLibravatar && avatarAvailable !== false}
                    disabled={avatarAvailable === false}
                    onCheckedChange={setUseLibravatar}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="about">
                    About <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                    id="about"
                    rows={3}
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    maxLength={2000}
                    placeholder="What's this channel about?"
                />
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full">
                {busy ? "Setting up…" : "Continue"}
            </Button>
        </form>
    );
};
