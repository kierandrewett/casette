// yt-dlp ".info.json" sidecar ingestion.
//
// When an operator pipes their NAS / arr-stack through yt-dlp before pushing
// to cassette, they probably already have the full set of metadata the
// downstream service produces. Re-deriving title / description / chapters /
// tags from the raw bytes is wasteful and error-prone (description chapters
// only get parsed via heuristic). Instead, we accept the original
// `<basename>.info.json` as a sidecar field on /api/upload and backfill
// from it BEFORE the videos row is inserted.
//
// We trust nothing: every field is bounded to the same limits the upload
// route enforces on form fields. The parser never throws on unknown keys —
// yt-dlp's schema drifts, and we want to be permissive.

const TAG_RE = /^[a-z0-9-]+$/;
const MAX_TAGS = 12;
const MAX_TAG_LEN = 30;
const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 10_000;

export type SidecarChapter = {
    startSec: number;
    endSec: number | null;
    title: string;
};

export type ParsedSidecar = {
    title?: string;
    description?: string;
    tags?: string[];
    publishedAt?: Date;
    chapters?: SidecarChapter[];
    /** First entry of the `thumbnails` array, if present. */
    thumbnailUrl?: string;
};

const slugifyTag = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const cleaned = raw
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, MAX_TAG_LEN);
    if (!cleaned || !TAG_RE.test(cleaned)) return null;
    return cleaned;
};

const parseTagList = (raw: unknown): string[] => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
        const tag = slugifyTag(item);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
        if (out.length >= MAX_TAGS) break;
    }
    return out;
};

const parseUploadDate = (raw: unknown): Date | undefined => {
    // yt-dlp emits `upload_date` as a YYYYMMDD string. `release_date` and
    // `timestamp` (unix seconds) are also present on some extractors.
    if (typeof raw === "string" && /^\d{8}$/.test(raw)) {
        const y = Number(raw.slice(0, 4));
        const m = Number(raw.slice(4, 6));
        const d = Number(raw.slice(6, 8));
        const dt = new Date(Date.UTC(y, m - 1, d));
        return Number.isNaN(dt.getTime()) ? undefined : dt;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
        const dt = new Date(raw * 1000);
        return Number.isNaN(dt.getTime()) ? undefined : dt;
    }
    return undefined;
};

const parseChapters = (raw: unknown): SidecarChapter[] | undefined => {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const out: SidecarChapter[] = [];
    for (const c of raw) {
        if (!c || typeof c !== "object") continue;
        const obj = c as Record<string, unknown>;
        const start = typeof obj["start_time"] === "number" ? obj["start_time"] : Number(obj["start_time"]);
        const end =
            typeof obj["end_time"] === "number"
                ? obj["end_time"]
                : obj["end_time"] !== undefined
                  ? Number(obj["end_time"])
                  : NaN;
        const title = typeof obj["title"] === "string" ? obj["title"] : "";
        if (!Number.isFinite(start) || start < 0 || !title) continue;
        out.push({
            startSec: Math.round(start),
            endSec: Number.isFinite(end) ? Math.round(end) : null,
            title: title.slice(0, 200),
        });
    }
    if (out.length === 0) return undefined;
    out.sort((a, b) => a.startSec - b.startSec);
    return out;
};

const parseThumbnail = (raw: unknown, fallback: unknown): string | undefined => {
    // yt-dlp's `thumbnails` is an ordered list (best last); `thumbnail` is
    // the chosen one. Prefer `thumbnail` when present.
    if (typeof fallback === "string" && /^https?:\/\//.test(fallback)) {
        return fallback;
    }
    if (Array.isArray(raw)) {
        // Walk in reverse so we get the highest-resolution variant first.
        for (let i = raw.length - 1; i >= 0; i--) {
            const t = raw[i];
            if (t && typeof t === "object" && typeof (t as Record<string, unknown>)["url"] === "string") {
                const url = (t as Record<string, unknown>)["url"] as string;
                if (/^https?:\/\//.test(url)) return url;
            }
        }
    }
    return undefined;
};

/**
 * Parse a yt-dlp `.info.json` buffer into the subset of fields cassette
 * cares about. Returns an empty object when the buffer is not valid JSON
 * or is missing every expected field — never throws.
 */
export const parseYtDlpSidecar = (buffer: Buffer): ParsedSidecar => {
    let json: unknown;
    try {
        json = JSON.parse(buffer.toString("utf8"));
    } catch {
        return {};
    }
    if (!json || typeof json !== "object") return {};

    const obj = json as Record<string, unknown>;
    const result: ParsedSidecar = {};

    if (typeof obj["title"] === "string") {
        const title = obj["title"].trim().slice(0, MAX_TITLE_LEN);
        if (title) result.title = title;
    }

    if (typeof obj["description"] === "string") {
        const description = obj["description"].slice(0, MAX_DESCRIPTION_LEN);
        if (description) result.description = description;
    }

    // yt-dlp commonly sets BOTH `tags` and `categories`. We treat tags as
    // the canonical source; categories have far less semantic meaning.
    const tags = parseTagList(obj["tags"]);
    if (tags.length > 0) result.tags = tags;

    const publishedAt =
        parseUploadDate(obj["release_date"]) ??
        parseUploadDate(obj["upload_date"]) ??
        parseUploadDate(obj["timestamp"]);
    if (publishedAt) result.publishedAt = publishedAt;

    const chapters = parseChapters(obj["chapters"]);
    if (chapters) result.chapters = chapters;

    const thumb = parseThumbnail(obj["thumbnails"], obj["thumbnail"]);
    if (thumb) result.thumbnailUrl = thumb;

    return result;
};
