"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { CloseIcon, DragHandleIcon } from "@/components/task/task-icons";
import { taskToolSidePanelClass } from "@/components/task/bulk-edit-side-panel";
import {
  reorderColumnOrder,
  setAllColumnVisibility,
  type TaskColumnState,
  type TaskWorkspaceColumn,
} from "@/lib/task-column-model";
import { cn } from "@/lib/utils";

interface TaskColumnsPanelProps {
  columns: TaskWorkspaceColumn[];
  getColumnLabel: (column: TaskWorkspaceColumn) => string;
  onColumnStateChange: (updater: (current: TaskColumnState) => TaskColumnState) => void;
  onClose: () => void;
}

export function TaskColumnsPanel({
  columns,
  getColumnLabel,
  onColumnStateChange,
  onClose,
}: TaskColumnsPanelProps) {
  const { messages } = useI18n();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const setAll = (visible: boolean) => {
    onColumnStateChange((current) => ({
      ...current,
      visibility: setAllColumnVisibility(current.visibility, columnIds, visible),
    }));
  };

  return (
    <aside className={taskToolSidePanelClass} aria-label={messages.taskWorkspace.columns}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
          <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
            {messages.taskWorkspace.columns}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            aria-label={messages.common.close}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <button
            type="button"
            className="rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            onClick={() => setAll(true)}
          >
            {messages.taskWorkspace.columnsPanel.selectAll}
          </button>
          <button
            type="button"
            className="rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            onClick={() => setAll(false)}
          >
            {messages.taskWorkspace.columnsPanel.deselectAll}
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {columns.map((column) => {
            const label = getColumnLabel(column);
            const isDragging = draggingId === column.id;
            const isDropTarget = overId === column.id && draggingId !== null && draggingId !== column.id;

            return (
              <div
                key={column.id}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2 transition-colors hover:bg-[var(--color-bg-hover)]",
                  isDragging && "opacity-40",
                  isDropTarget && "outline outline-1 outline-[var(--color-accent)]",
                )}
                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                  if (!draggingId) return;
                  event.preventDefault();
                  setOverId(column.id);
                }}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  if (!draggingId || draggingId === column.id) {
                    setOverId(null);
                    return;
                  }
                  event.preventDefault();
                  onColumnStateChange((current) => ({
                    ...current,
                    order: reorderColumnOrder(columnIds, current.order, draggingId, column.id),
                  }));
                  setOverId(null);
                }}
              >
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={messages.taskWorkspace.columnsPanel.dragHandle}
                  title={messages.taskWorkspace.columnsPanel.dragHandle}
                  draggable
                  onDragStart={(event) => {
                    setDraggingId(column.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", column.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverId(null);
                  }}
                  className="inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] active:cursor-grabbing"
                >
                  <DragHandleIcon className="h-4 w-4" />
                </span>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      onColumnStateChange((current) => ({
                        ...current,
                        visibility: { ...current.visibility, [column.id]: checked },
                      }));
                    }}
                    className="h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 truncate text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                    {label}
                  </span>
                </label>
                {column.kind === "custom" && (
                  <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[length:var(--text-3xs)] uppercase text-[var(--color-text-tertiary)]">
                    {messages.taskWorkspace.columnsPanel.customBadge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
    </aside>
  );
}
