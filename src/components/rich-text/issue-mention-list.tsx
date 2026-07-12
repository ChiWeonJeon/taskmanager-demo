"use client";

import { forwardRef } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { BaseMentionList, type BaseMentionListHandle } from "./base-mention-list";

export interface IssueMentionItem {
  id: string;
  issueKey: string;
  title: string;
}

export type IssueMentionListHandle = BaseMentionListHandle;

export interface IssueMentionListProps {
  items: IssueMentionItem[];
  command: (item: { id: string; label: string }) => void;
  emptyMessage?: string;
}

export const IssueMentionList = forwardRef<IssueMentionListHandle, IssueMentionListProps>(
  ({ items, command, emptyMessage }, ref) => {
    const { messages } = useI18n();
    return (
      <BaseMentionList<IssueMentionItem>
        ref={ref}
        items={items}
        command={command}
        labelFor={(it) => it.issueKey}
        emptyMessage={emptyMessage ?? messages.commonUi.mentionEmptyIssues}
        renderRow={(it) => (
          <>
            <span className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
              {it.issueKey}
            </span>
            <span className="truncate">{it.title}</span>
          </>
        )}
      />
    );
  }
);
IssueMentionList.displayName = "IssueMentionList";
