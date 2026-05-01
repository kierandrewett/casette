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
