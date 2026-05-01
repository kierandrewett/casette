import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BulkUploadForm } from "@/components/studio/BulkUploadForm";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioUploadForm } from "@/components/studio/StudioUploadForm";
import { UploadPageTabs } from "@/components/studio/UploadPageTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/server";

type Props = {
    params: Promise<{ handle: string }>;
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
    const { handle } = await params;
    return { title: `Upload — @${handle} — Studio` };
};

const StudioUploadPage = async ({ params }: Props) => {
    const { handle } = await params;

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

    const channelInfo = { id: membership.id, handle: membership.handle };

    return (
        <>
            <StudioPageHeader
                title="Upload video"
                description={
                    <>
                        Add a new video to <span className="font-medium text-foreground">@{membership.handle}</span>. We
                        accept MP4, WebM, and MKV; transcoding to an HLS ladder happens automatically once the upload
                        finishes.
                    </>
                }
            />

            {/* Upload form caps at a comfortable reading width inside the wide
                canvas — the upload form's content (drop zone + metadata) reads
                better in a single column than fanned across the full row. */}
            <div className="max-w-4xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Source &amp; metadata</CardTitle>
                        <CardDescription>
                            Drop your file in below, then add a title, description, and tags. Switch to{" "}
                            <span className="font-medium text-foreground">Bulk</span> to upload multiple files at once.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <UploadPageTabs
                            singleForm={<StudioUploadForm channel={channelInfo} />}
                            bulkForm={<BulkUploadForm channel={channelInfo} />}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default StudioUploadPage;
