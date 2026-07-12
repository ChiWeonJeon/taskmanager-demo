"use client";

import { CommentBubbleIcon } from "@/components/task/task-icons";
import { useI18n } from "@/components/shared/locale-provider";
import { cn } from "@/lib/utils";

interface TaskCommentCountButtonProps {
  count: number;
  onClick: () => void;
  className?: string;
}

export function TaskCommentCountButton({ count, onClick, className }: TaskCommentCountButtonProps) {
  const { messages } = useI18n();
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-accent)]",
        className
      )}
      aria-label={messages.commonUi.commentJumpAriaLabel.replace("{count}", String(count))}
      title={messages.commonUi.commentJumpTitle}
    >
      <CommentBubbleIcon className="h-3.5 w-3.5" />
      <span>{count}</span>
    </button>
  );
}
