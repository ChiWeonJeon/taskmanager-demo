"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { DragHandleIcon, SortAscendingIcon, SortDescendingIcon, SortIcon } from "@/components/task/task-icons";
import { cn } from "@/lib/utils";

// Shared admin-style table — extracted from `admin/field-schema-list.tsx`,
// `admin/users/page.tsx`, `admin/roles/page.tsx`, `admin/project-groups/page.tsx`,
// which all hand-rolled near-identical `<table>` markup. New use cases (e.g.
// the checklist hub) opt into this module so further admin pages can migrate
// incrementally without copy-paste regressions.
//
// Optional `onReorder` enables HTML5 drag-and-drop on a dedicated handle column;
// rows stay clickable through the rest of the row when `getRowHref` is set.

export type DataTableResponsive = "always" | "sm" | "md" | "lg";

export type SortDirection = "asc" | "desc";

export interface DataTableSort {
  columnId: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  responsive?: DataTableResponsive;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  /** When true, the header becomes a clickable sort toggle (controlled via `sort`/`onToggleSort`). */
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  loadingRowCount?: number;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  getRowHref?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  onReorder?: (orderedIds: string[]) => void;
  reorderHandleLabel?: string;
  className?: string;
  /** Current sort state for sortable columns (controlled). */
  sort?: DataTableSort | null;
  /** Called with a column id when a sortable header is clicked. */
  onToggleSort?: (columnId: string) => void;
  /** Keeps the header visible while the table body scrolls. */
  stickyHeader?: boolean;
}

const RESPONSIVE_CLASS: Record<DataTableResponsive, string> = {
  always: "",
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  loadingRowCount = 4,
  emptyState,
  errorState,
  getRowHref,
  onRowClick,
  onReorder,
  reorderHandleLabel,
  className,
  sort,
  onToggleSort,
  stickyHeader = false,
}: DataTableProps<T>) {
  const { messages } = useI18n();
  const draggableEnabled = Boolean(onReorder);
  const dragLabel = reorderHandleLabel ?? messages.commonUi.dragHandleLabel;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dragOrigin = useRef<string | null>(null);

  if (errorState) {
    return <>{errorState}</>;
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden bg-[var(--color-bg-primary)]",
        className,
      )}
    >
      <table className="w-full table-fixed text-left">
        <thead
          className={cn(
            "text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]",
            stickyHeader && "sticky top-0 z-10 bg-[var(--color-bg-primary)]",
          )}
        >
          <tr>
            {draggableEnabled && <th className="w-8 px-2 py-2" aria-hidden="true" />}
            {columns.map((col) => {
              const isSorted = sort?.columnId === col.id;
              const sortable = Boolean(col.sortable && onToggleSort);
              return (
                <th
                  key={col.id}
                  aria-sort={
                    isSorted
                      ? sort?.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "px-3 py-2 font-medium",
                    RESPONSIVE_CLASS[col.responsive ?? "always"],
                    col.align && ALIGN_CLASS[col.align],
                    col.headerClassName,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onToggleSort?.(col.id)}
                      className="inline-flex items-center gap-1 font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                    >
                      {col.header}
                      {isSorted ? (
                        sort?.direction === "asc" ? (
                          <SortAscendingIcon aria-label={messages.commonUi.sortAscendingLabel} className="h-3.5 w-3.5" />
                        ) : (
                          <SortDescendingIcon aria-label={messages.commonUi.sortDescendingLabel} className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <SortIcon aria-label={messages.commonUi.sortNeutralLabel} className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: loadingRowCount }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {draggableEnabled && <td className="px-2 py-2.5" />}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "px-3 py-2.5",
                        RESPONSIVE_CLASS[col.responsive ?? "always"],
                      )}
                    >
                      <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.length === 0
              ? (
                <tr>
                  <td
                    colSpan={columns.length + (draggableEnabled ? 1 : 0)}
                    className="px-3 py-6 text-center text-[length:var(--text-xs)] text-[var(--color-text-secondary)]"
                  >
                    {emptyState ?? null}
                  </td>
                </tr>
              )
              : rows.map((row, idx) => {
                  const id = rowKey(row);
                  const href = getRowHref?.(row);
                  const isDragging = draggingId === id;
                  const isDropTarget = overId === id && draggingId !== null && draggingId !== id;
                  const handleClick = onRowClick
                    ? () => onRowClick(row)
                    : undefined;
                  return (
                    <tr
                      key={id}
                      className={cn(
                        "align-top transition-colors",
                        (handleClick || href) && "cursor-pointer hover:bg-[var(--color-bg-hover)]",
                        isDragging && "opacity-40",
                        isDropTarget && "outline outline-1 outline-[var(--color-accent)]",
                      )}
                      onClick={handleClick}
                      onDragOver={
                        draggableEnabled
                          ? (e) => {
                              if (!draggingId) return;
                              e.preventDefault();
                              setOverId(id);
                            }
                          : undefined
                      }
                      onDrop={
                        draggableEnabled
                          ? (e) => {
                              if (!draggingId || draggingId === id) {
                                setOverId(null);
                                return;
                              }
                              e.preventDefault();
                              const ids = rows.map((r) => rowKey(r));
                              const fromIdx = ids.indexOf(draggingId);
                              const toIdx = ids.indexOf(id);
                              if (fromIdx === -1 || toIdx === -1) return;
                              const next = [...ids];
                              next.splice(fromIdx, 1);
                              next.splice(toIdx, 0, draggingId);
                              setOverId(null);
                              onReorder?.(next);
                            }
                          : undefined
                      }
                    >
                      {draggableEnabled && (
                        <td className="w-8 px-2 py-2.5 align-middle">
                          <span
                            role="button"
                            tabIndex={-1}
                            aria-label={dragLabel}
                            title={dragLabel}
                            draggable
                            onDragStart={(e) => {
                              dragOrigin.current = id;
                              setDraggingId(id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", id);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setOverId(null);
                              dragOrigin.current = null;
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] active:cursor-grabbing"
                          >
                            <DragHandleIcon className="h-4 w-4" />
                          </span>
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn(
                            "min-w-0 break-words px-3 py-2.5",
                            RESPONSIVE_CLASS[col.responsive ?? "always"],
                            col.align && ALIGN_CLASS[col.align],
                            col.className,
                          )}
                        >
                          {col.cell(row, idx)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
        </tbody>
      </table>
    </div>
  );
}
