"use client";

import { forwardRef, type ReactNode, useImperativeHandle, useState } from "react";

export interface BaseMentionItem {
  id: string;
}

export interface BaseMentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface BaseMentionListProps<T extends BaseMentionItem> {
  items: T[];
  command: (item: { id: string; label: string }) => void;
  labelFor: (item: T) => string;
  renderRow: (item: T, active: boolean) => ReactNode;
  emptyMessage: string;
}

function BaseMentionListInner<T extends BaseMentionItem>(
  { items, command, labelFor, renderRow, emptyMessage }: BaseMentionListProps<T>,
  ref: React.Ref<BaseMentionListHandle>
) {
  const signature = items.map((i) => i.id).join("|");
  const [prevSignature, setPrevSignature] = useState(signature);
  const [index, setIndex] = useState(0);
  if (prevSignature !== signature) {
    setPrevSignature(signature);
    setIndex(0);
  }

  const select = (i: number) => {
    const item = items[i];
    if (!item) return;
    command({ id: item.id, label: labelFor(item) });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        select(index);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="w-[min(280px,85vw)] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1 shadow-[var(--shadow-md)]">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
          {emptyMessage}
        </div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              select(i);
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[length:var(--text-xs)] ${
              i === index ? "bg-[var(--color-bg-hover)]" : ""
            }`}
          >
            {renderRow(item, i === index)}
          </button>
        ))
      )}
    </div>
  );
}

export const BaseMentionList = forwardRef(BaseMentionListInner) as <
  T extends BaseMentionItem
>(
  props: BaseMentionListProps<T> & { ref?: React.Ref<BaseMentionListHandle> }
) => ReturnType<typeof BaseMentionListInner>;
