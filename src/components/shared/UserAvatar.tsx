import Image from "next/image";

import { gravatarUrl, gravatarUrlFromHash, userInitials } from "@/lib/gravatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        // Pre-hashed Gravatar key. Prefer this over `email` for any payload
        // that crosses the server/client boundary so we never leak addresses.
        gravatarHash?: string | null;
    };
    size?: number;
    className?: string;
}

// Site-wide user avatar with libravatar/gravatar fallback. Order:
//   1. user.image (if set — could be uploaded later)
//   2. libravatar/gravatar URL keyed on user.gravatarHash (preferred) or user.email
//   3. initials roundel
//
// Libravatar's mystery-person fallback is not styled to match the cassette
// dark theme, so a missing-email account renders as initials instead.
export const UserAvatar = ({ user, size = 32, className }: UserAvatarProps) => {
    const px = Math.max(80, size * 2);
    const src =
        user.image ??
        (user.gravatarHash ? gravatarUrlFromHash(user.gravatarHash, px) : null) ??
        (user.email ? gravatarUrl(user.email, px) : null);
    const initials = userInitials(user.name);

    return (
        <span
            className={cn(
                "inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-foreground/80 ring-1 ring-border/40",
                className,
            )}
            style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }}
            aria-hidden="true"
        >
            {src ? (
                <Image src={src} alt="" width={size} height={size} unoptimized className="h-full w-full object-cover" />
            ) : (
                <span className="font-semibold">{initials}</span>
            )}
        </span>
    );
};
