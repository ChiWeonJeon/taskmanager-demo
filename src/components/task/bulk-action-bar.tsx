"use client";

import { useI18n } from "@/components/shared/locale-provider";
import { Button } from "@/components/ui/button";
import { BULK_WORK_ITEM_ACTION_LIMIT } from "@/components/task/use-bulk-work-item-actions";

interface BulkActionBarProps {
  selectedCount: number;
  pending: boolean;
  onOpenFieldPanel: () => void;
  onOpenStatusPanel: () => void;
  onRequestDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({
  selectedCount,
  pending,
  onOpenFieldPanel,
  onOpenStatusPanel,
  onRequestDelete,
  onClearSelection,
}: BulkActionBarProps) {
  const { messages } = useI18n();
  const t = messages.taskWorkspace.bulkBar;
  const selectedCountLabel = t.selectedCount.replace("{count}", String(selectedCount));
  const tooManySelected = selectedCount > BULK_WORK_ITEM_ACTION_LIMIT;
  const tooManyLabel = t.tooManySelected.replace("{max}", String(BULK_WORK_ITEM_ACTION_LIMIT));

  if (selectedCount === 0) return null;

  return (
    <div className="fixed inset-x-3 bottom-[96px] z-[60] mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 shadow-[var(--shadow-lg)] md:bottom-4">
      <span className="min-w-0 text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
        {selectedCountLabel}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onOpenFieldPanel} disabled={pending}>
          {t.fieldChange}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onOpenStatusPanel} disabled={pending}>
          {t.statusChange}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={onRequestDelete}
          disabled={pending || tooManySelected}
          title={tooManySelected ? tooManyLabel : undefined}
        >
          {t.deleteAction}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClearSelection} disabled={pending}>
          {t.clearSelection}
        </Button>
      </div>
    </div>
  );
}
