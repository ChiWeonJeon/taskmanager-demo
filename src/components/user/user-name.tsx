"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { UserAvatar, type AvatarSize } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import {
  type DisplayUser,
  getDisplayName,
  shouldShowFullNameTooltip,
} from "@/lib/user/display";

interface UserNameProps {
  user?: DisplayUser | null;
  fallback?: ReactNode;
  withAvatar?: boolean;
  avatarSize?: AvatarSize;
  className?: string;
  labelClassName?: string;
  truncate?: boolean;
}

export function UserName({
  user,
  fallback,
  withAvatar = false,
  avatarSize = "sm",
  className,
  labelClassName,
  truncate = true,
}: UserNameProps) {
  if (!user) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
        {fallback ?? null}
      </span>
    );
  }

  const display = getDisplayName(user);
  const showTooltip = shouldShowFullNameTooltip(user);

  const inner = (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {withAvatar && <UserAvatar user={user} size={avatarSize} />}
      <span className={cn(truncate && "truncate", labelClassName)}>{display}</span>
    </span>
  );

  if (!showTooltip) return inner;

  return (
    <Tooltip content={user.name}>
      {inner}
    </Tooltip>
  );
}
