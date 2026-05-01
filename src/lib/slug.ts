import { customAlphabet } from "nanoid";

// nanoid alphabet: URL-safe, 64 entries. 22 chars gives ~131 bits of entropy,
// which we use as the unlisted-video URL secret. 22+ chars is the project
// convention.
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_";

const id22 = customAlphabet(alphabet, 22);

export const unlistedSlug = (): string => id22();

const handleAlphabet = "abcdefghijkmnopqrstuvwxyz0123456789";
const id12 = customAlphabet(handleAlphabet, 12);

export const fallbackHandle = (): string => id12();

export const isValidHandle = (handle: string): boolean => /^[a-z0-9][a-z0-9_-]{2,29}$/.test(handle);

// Public-facing video id. 11 chars, URL-safe alphabet (no ambiguous I/l/0/O).
// 11 × log2(57) ≈ 64 bits — well above the collision probability we'd ever
// hit at self-host scale.
const publicIdAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const id11 = customAlphabet(publicIdAlphabet, 11);

export const videoPublicId = (): string => id11();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const looksLikeUuid = (s: string): boolean => UUID_RE.test(s);
