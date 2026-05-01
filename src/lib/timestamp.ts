// Timestamp parsing for ?t= query params on /watch and /embed URLs.
//
// Accepts both raw seconds ("123", "42") and YouTube-style human form
// ("1m23s", "2h05m", "90s"). Returns the parsed value in seconds, or null
// if the input cannot be parsed. Be permissive: empty inputs yield null;
// negative or non-finite values are rejected.

const HUMAN_RE = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;

export const parseTimestamp = (raw: string | null | undefined): number | null => {
    if (!raw) return null;
    const s = raw.trim().toLowerCase();
    if (s.length === 0) return null;

    // Pure-integer fast path: "42", "123" — interpret as seconds.
    if (/^\d+$/.test(s)) {
        const n = Number(s);
        return Number.isFinite(n) && n >= 0 ? n : null;
    }

    const m = HUMAN_RE.exec(s);
    if (!m) return null;

    const [, hStr, mStr, sStr] = m;
    if (!hStr && !mStr && !sStr) return null;

    const h = hStr ? parseInt(hStr, 10) : 0;
    const min = mStr ? parseInt(mStr, 10) : 0;
    const sec = sStr ? parseInt(sStr, 10) : 0;

    const total = h * 3600 + min * 60 + sec;
    return Number.isFinite(total) && total >= 0 ? total : null;
};
