"use client";

import { useEffect, useMemo } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { WarningIcon } from "@/components/task/task-icons";
import type { StatusOption, WorkItemWithRelations } from "@/components/task/types";
import {
  BULK_WORK_ITEM_ACTION_LIMIT,
  getCommonStatusOptions,
} from "@/components/task/use-bulk-work-item-actions";
import type { TransitionsByIssueType } from "@/lib/task-status";
import type { WorkspaceField } from "@/lib/workspace-field-model";
import { cn } from "@/lib/utils";

interface BulkContextMenuProps {
  selectedTasks: WorkItemWithRelations[];
  position: { x: number; y: number };
  statuses: StatusOption[];
  allowedStatusIdsByIssueType?: Record<string, string[]>;
  transitionsByIssueType?: TransitionsByIssueType;
  workspaceFields: WorkspaceField[];
  pending: boolean;
  onClose: () => void;
  onApplyStatusChange: (statusId: string) => void;
  onOpenStatusPanel: () => void;
  onOpenFieldPanel: () => void;
  onRequestDelete: () => void;
  onClearSelection: () => void;
}

export function BulkContextMenu({
  selectedTasks,
  position,
  statuses,
  allowedStatusIdsByIssueType,
  transitionsByIssueType,
  workspaceFields,
  pending,
  onClose,
  onApplyStatusChange,
  onOpenStatusPanel,
  onOpenFieldPanel,
  onRequestDelete,
  onClearSelection,
}: BulkContextMenuProps) {
  const { messages } = useI18n();
  const t = messages.taskWorkspace.bulkBar;
  const selectedCountLabel = t.selectedCount.replace("{count}", String(selectedTasks.length));
  const tooManySelected = selectedTasks.length > BULK_WORK_ITEM_ACTION_LIMIT;
  const commonStatusOptions = useMemo(
    () => getCommonStatusOptions(selectedTasks, statuses, allowedStatusIdsByIssueType, transitionsByIssueType),
    [allowedStatusIdsByIssueType, selectedTasks, statuses, transitionsByIssueType],
  );
  const hasEditableFields = workspaceFields.some((field) => !field.isSystem);
  const tooManyLabel = t.tooManySelected.replace("{max}", String(BULK_WORK_ITEM_ACTION_LIMIT));

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <FloatingPortal
      open
      anchorPoint={position}
      placement="bottom"
      align="start"
      offset={0}
      preferredWidth={240}
      maxHeight={520}
      zIndex={201}
      className="min-w-[240px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1 shadow-[var(--shadow-lg)]"
      onClick={(event) => event.stopPropagation()}
    >
        <div className="px-3 py-1.5 text-[length:var(--text-3xs)] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {selectedCountLabel}
        </div>

        {tooManySelected && (
          <div className="mx-2 my-1 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] px-2.5 py-2 text-[length:var(--text-xs)] text-[var(--color-warning)]">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{tooManyLabel}</span>
          </div>
        )}

        {!tooManySelected && commonStatusOptions.length > 0 && (
          <>
            <div className="my-1 border-t border-[var(--color-border)]" />
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              onClick={() => {
                onOpenStatusPanel();
                onClose();
              }}
            >
              {t.statusChange}
            </button>
            <div className="px-3 py-1 text-[length:var(--text-3xs)] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {messages.contextMenu.status}
            </div>
            {commonStatusOptions.map((status) => (
              <button
                key={status.id}
                type="button"
                disabled={pending}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50",
                )}
                onClick={() => {
                  onApplyStatusChange(status.id);
                  onClose();
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="flex-1 text-[var(--color-text-primary)]">{status.name}</span>
              </button>
            ))}
          </>
        )}

        {hasEditableFields && (
          <>
            <div className="my-1 border-t border-[var(--color-border)]" />
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 text-xs text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              onClick={() => {
                onOpenFieldPanel();
                onClose();
              }}
            >
              {t.fieldChange}
            </button>
          </>
        )}

        <div className="my-1 border-t border-[var(--color-border)]" />

        <button
          type="button"
          disabled={pending || tooManySelected}
          className="flex w-full items-center px-3 py-2 text-xs text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-light)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            onRequestDelete();
            onClose();
          }}
        >
          {messages.contextMenu.deleteSelected.replace("{count}", String(selectedTasks.length))}
        </button>

        <button
          type="button"
          className="flex w-full items-center px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          onClick={() => {
            onClearSelection();
            onClose();
          }}
        >
          {t.clearSelection}
        </button>
    </FloatingPortal>
  );
}
