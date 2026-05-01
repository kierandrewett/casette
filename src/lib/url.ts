// URL helpers for video routes. Always prefer the short publicId over the
// internal UUID when both are available — the publicId fits on a card,
// survives being verbatim-shared, and the resolvers in /watch and /embed
// accept either form for backward compatibility.

interface VideoLike {
    id: string;
    publicId?: string | null;
    unlistedSlug?: string | null;
}

export const watchHref = (video: VideoLike): string => {
    const id = video.publicId ?? video.id;
    return video.unlistedSlug ? `/watch/${id}?slug=${video.unlistedSlug}` : `/watch/${id}`;
};

export const embedHref = (video: VideoLike): string => {
    const id = video.publicId ?? video.id;
    return video.unlistedSlug ? `/embed/${id}?slug=${video.unlistedSlug}` : `/embed/${id}`;
};
