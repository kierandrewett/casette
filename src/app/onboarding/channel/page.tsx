import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { CassetteWordmark } from "@/components/branding/CassetteWordmark";
import { OnboardingChannelForm } from "./OnboardingChannelForm";
import { gravatarHash } from "@/lib/gravatar";
import { getSession } from "@/lib/session";
import { db } from "@/server/db/client";
import { channels } from "@/server/db/schema/channels";

export const metadata: Metadata = { title: "Set up your channel" };

// First-run onboarding. The register form routes here after signup; we also
// catch any signed-in viewer with zero channels who lands here directly.
//
// Once the user has at least one channel we treat onboarding as complete and
// bounce them home so re-visiting /onboarding/channel doesn't re-prompt.
const OnboardingChannelPage = async () => {
    const session = await getSession();
    if (!session?.user) {
        redirect("/login?next=/onboarding/channel");
    }

    const existing = await db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.ownerId, session.user.id))
        .limit(1);
    if (existing.length > 0) {
        redirect("/");
    }

    // Compute the libravatar hash server-side so the form can render the
    // preview (and the client never needs the raw email beyond what it
    // already has from useSession()).
    const avatarHash = gravatarHash(session.user.email);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
            <header className="space-y-3 text-center">
                <CassetteWordmark className="mx-auto" />
                <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                    Set up your channel
                </h1>
                <p className="mx-auto max-w-md text-balance text-sm text-muted-foreground">
                    Every account on cassette gets one channel where your videos live. You can create more later.
                </p>
            </header>
            <OnboardingChannelForm
                defaultName={session.user.name}
                avatarHash={avatarHash}
            />
        </main>
    );
};

export default OnboardingChannelPage;
