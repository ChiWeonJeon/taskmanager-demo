"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/shared/locale-provider";
import { CheckSmallIcon } from "@/components/task/task-icons";
import { FloatingPortal } from "@/components/ui/floating-portal";
import {
  WorkItemWithRelations,
  StatusOption,
  IssueTypeOption,
  ResolvedProjectConfig,
  WorkItemUpdate,
} from "@/components/task/types";

interface ContextMenuProps {
  task: WorkItemWithRelations;
  position: { x: number; y: number };
  statuses: StatusOption[];
  issueTypes: IssueTypeOption[];
  onClose: () => void;
  onOpen: () => void;
  onUpdate: (id: string, data: WorkItemUpdate) => void;
  onDelete: (id: string) => void;
}

export function ContextMenu({
  task,
  position,
  statuses,
  issueTypes,
  onClose,
  onOpen,
  onUpdate,
  onDelete,
}: ContextMenuProps) {
  const { messages } = useI18n();
  const { data: projectConfig } = useQuery<ResolvedProjectConfig>({
    queryKey: ["project-config", task.projectId],
    enabled: Boolean(task.projectId),
    queryFn: async () => {
      if (!task.projectId) throw new Error("Project is required");
      const response = await fetch(`/api/projects/${task.projectId}/config`);
      if (!response.ok) throw new Error("Failed to fetch project configuration");
      return response.json();
    },
    staleTime: 30_000,
  });

  const typeOptions = useMemo(() => {
    const scopedIssueTypes = task.projectId
      ? projectConfig?.enabledIssueTypes ?? []
      : issueTypes;
    const next = [...scopedIssueTypes];

    if (!next.some((issueType) => issueType.id === task.issueTypeId)) {
      const currentIssueType = issueTypes.find((issueType) => issueType.id === task.issueTypeId);
      if (currentIssueType) next.push(currentIssueType);
    }

    return next;
  }, [issueTypes, projectConfig?.enabledIssueTypes, task.issueTypeId, task.projectId]);

  const selectedIssueType =
    typeOptions.find((issueType) => issueType.id === task.issueTypeId)
    ?? issueTypes.find((issueType) => issueType.id === task.issueTypeId)
    ?? null;
  const statusOptions = selectedIssueType?.statusSchema?.statuses.map((entry) => entry.status) ?? statuses;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const menu = (
    <>
      <div
        className="fixed inset-0 z-[200]"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />

      <FloatingPortal
        open
        anchorPoint={position}
        placement="bottom"
        align="start"
        offset={0}
        preferredWidth={220}
        maxHeight={520}
        zIndex={201}
        className="min-w-[220px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1 shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-3 py-1.5 text-[length:var(--text-3xs)] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {task.issueKey}
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
          onClick={() => {
            onOpen();
            onClose();
          }}
        >
          <span>{messages.contextMenu.openTask}</span>
          <span className="text-[var(--color-text-tertiary)]">↗</span>
        </button>

        <div className="my-1 border-t border-[var(--color-border)]" />

        <div className="px-3 py-1 text-[length:var(--text-3xs)] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {messages.contextMenu.status}
        </div>
        {statusOptions.map((status) => (
          <button
            key={status.id}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-bg-hover)]"
            onClick={() => {
              onUpdate(task.id, { statusId: status.id });
              onClose();
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
            <span className="flex-1 text-[var(--color-text-primary)]">{status.name}</span>
            {task.statusId === status.id && <CheckSmallIcon className="h-4 w-4 text-[var(--color-accent)]" />}
          </button>
        ))}

        <div className="my-1 border-t border-[var(--color-border)]" />

        <div className="px-3 py-1 text-[length:var(--text-3xs)] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {messages.contextMenu.type}
        </div>
        {typeOptions.map((issueType) => (
          <button
            key={issueType.id}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-bg-hover)]"
            onClick={() => {
              onUpdate(task.id, { issueTypeId: issueType.id });
              onClose();
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: issueType.color ?? "var(--color-text-tertiary)" }}
            />
            <span className="flex-1 text-[var(--color-text-primary)]">{issueType.name}</span>
            {task.issueTypeId === issueType.id && <CheckSmallIcon className="h-4 w-4 text-[var(--color-accent)]" />}
          </button>
        ))}

        <div className="my-1 border-t border-[var(--color-border)]" />

        <button
          type="button"
          className="flex w-full items-center px-3 py-2 text-xs text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-light)]"
          onClick={() => {
            onDelete(task.id);
            onClose();
          }}
        >
          {messages.contextMenu.delete}
        </button>
      </FloatingPortal>
    </>
  );

  return createPortal(menu, document.body);
}
