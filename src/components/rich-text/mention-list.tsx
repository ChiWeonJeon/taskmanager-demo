"use client";

import { forwardRef } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { BaseMentionList, type BaseMentionListHandle } from "./base-mention-list";

export interface MentionUser {
  id: string;
  name: string;
  email: string;
}

export type MentionListHandle = BaseMentionListHandle;

export interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
  emptyMessage?: string;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command, emptyMessage }, ref) => {
    const { messages } = useI18n();
    return (
      <BaseMentionList<MentionUser>
        ref={ref}
        items={items}
        command={command}
        labelFor={(u) => u.name}
        emptyMessage={emptyMessage ?? messages.commonUi.mentionEmptyUsers}
        renderRow={(user) => (
          <>
            <span className="font-medium">{user.name}</span>
            <span className="text-[var(--color-text-secondary)]">
              @{user.email.split("@")[0]}
            </span>
          </>
        )}
      />
    );
  }
);
MentionList.displayName = "MentionList";
