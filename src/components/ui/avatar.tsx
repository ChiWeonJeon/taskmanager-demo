"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  type DisplayUser,
  getAvatarColor,
  getAvatarUrl,
  getDisplayName,
  getInitials,
} from "@/lib/user/display";

export type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 40,
};

const SIZE_TEXT: Record<AvatarSize, string> = {
  xs: "text-[length:var(--text-3xs)]",
  sm: "text-[length:var(--text-3xs)]",
  md: "text-[length:var(--text-2xs)]",
  lg: "text-[length:var(--text-base)]",
};

interface UserAvatarProps {
  user: DisplayUser;
  size?: AvatarSize;
  className?: string;
}

export function UserAvatar({ user, size = "sm", className }: UserAvatarProps) {
  const [errored, setErrored] = useState(false);
  const url = getAvatarUrl(user);
  const px = SIZE_PX[size];
  const displayName = getDisplayName(user);

  if (url && !errored) {
    return (
      <span
        className={cn(
          "inline-block flex-shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-secondary)] align-middle",
          className,
        )}
        style={{ width: px, height: px }}
        aria-label={displayName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  const initials = getInitials(user);
  const color = getAvatarColor(user);
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white align-middle",
        SIZE_TEXT[size],
        className,
      )}
      style={{ width: px, height: px, backgroundColor: color }}
      aria-label={displayName}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}
