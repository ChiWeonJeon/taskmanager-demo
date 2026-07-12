"use client";

import { useCallback, useMemo, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import type { StatusOption, WorkItemWithRelations } from "@/components/task/types";
import {
  getAllowedStatusesForIssueType,
  getAllowedTransitionTargets,
  type TransitionsByIssueType,
} from "@/lib/task-status";
import { useToast } from "@/lib/toast";
import type { WorkspaceField } from "@/lib/workspace-field-model";

export const BULK_WORK_ITEM_ACTION_LIMIT = 200;

export type BulkFieldValue = string | string[] | null;

interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  items: { id: string; success: boolean; error?: string }[];
}

interface UseBulkWorkItemActionsParams {
  selectedTasks: WorkItemWithRelations[];
  onClearSelection: () => void;
  onRefresh: () => void;
  onDone?: () => void;
}

export function isMultiValueField(field: WorkspaceField) {
  return ["MULTI_SELECT", "MULTI_REFERENCE", "MULTI_OBJECT_REF", "MULTI_ENTITY_REF"].includes(field.type);
}

export function isOptionField(field: WorkspaceField) {
  return ["SELECT", "REFERENCE", "OBJECT_REF", "ENTITY_REF", "USER"].includes(field.type);
}

export function toEditableFieldValue(field: WorkspaceField, value: Exclude<BulkFieldValue, null>) {
  if (isMultiValueField(field)) return Array.isArray(value) ? value : [];
  return Array.isArray(value) ? "" : value;
}

export function getCommonStatusOptions(
  selectedTasks: WorkItemWithRelations[],
  statuses: StatusOption[],
  allowedStatusIdsByIssueType?: Record<string, string[]>,
  transitionsByIssueType?: TransitionsByIssueType,
) {
  let commonIds: Set<string> | null = null;
  const statusById = new Map<string, StatusOption>();

  for (const task of selectedTasks) {
    const allowedStatuses = getAllowedTransitionTargets(
      task.issueTypeId,
      task.statusId,
      getAllowedStatusesForIssueType(task.issueTypeId, statuses, allowedStatusIdsByIssueType),
      transitionsByIssueType,
    );
    for (const status of allowedStatuses) statusById.set(status.id, status);
    const allowedIds = new Set(allowedStatuses.map((status) => status.id));
    if (commonIds === null) {
      commonIds = allowedIds;
    } else {
      const previousIds: Set<string> = commonIds;
      commonIds = new Set(Array.from(previousIds).filter((id) => allowedIds.has(id)));
    }
  }

  if (!commonIds) return [];
  return statuses
    .filter((status) => commonIds?.has(status.id))
    .map((status) => statusById.get(status.id) ?? status);
}

async function readBulkResult(response: Response): Promise<BulkResult> {
  const body = await response.json().catch(() => null) as (BulkResult & { error?: string }) | null;
  if (!body || !Array.isArray(body.items)) {
    throw new Error(body?.error || response.statusText);
  }
  return body;
}

export function useBulkWorkItemActions({
  selectedTasks,
  onClearSelection,
  onRefresh,
  onDone,
}: UseBulkWorkItemActionsParams) {
  const { messages } = useI18n();
  const { toast } = useToast();
  const t = messages.taskWorkspace.bulkBar;
  const [pending, setPending] = useState(false);
  const selectedIds = useMemo(() => selectedTasks.map((task) => task.id), [selectedTasks]);

  const errorLabel = useCallback((code: string | undefined) => {
    if (!code) return null;
    const errors = t.errors as Record<string, string>;
    return errors[code] ?? code;
  }, [t.errors]);

  const showTooManySelected = useCallback(() => {
    toast(t.tooManySelected.replace("{max}", String(BULK_WORK_ITEM_ACTION_LIMIT)), {
      type: "warning",
      sticky: true,
    });
  }, [t.tooManySelected, toast]);

  const showResult = useCallback((result: BulkResult) => {
    const summary = t.resultSummary
      .replace("{succeeded}", String(result.succeeded))
      .replace("{failed}", String(result.failed));
    const firstError = errorLabel(result.items.find((item) => !item.success)?.error);
    toast(firstError ? `${summary} ${firstError}` : summary, {
      type: result.failed > 0 ? "warning" : "success",
      sticky: result.failed > 0,
    });
    if (result.succeeded > 0) {
      onRefresh();
      onClearSelection();
      onDone?.();
    }
  }, [errorLabel, onClearSelection, onDone, onRefresh, t.resultSummary, toast]);

  const runBulkRequest = useCallback(async (request: () => Promise<Response>) => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length > BULK_WORK_ITEM_ACTION_LIMIT) {
      showTooManySelected();
      return;
    }
    setPending(true);
    try {
      const response = await request();
      const result = await readBulkResult(response);
      showResult(result);
    } catch (error) {
      toast(error instanceof Error ? error.message : messages.errors.failedToUpdate, { type: "error", sticky: true });
    } finally {
      setPending(false);
    }
  }, [messages.errors.failedToUpdate, selectedIds.length, showResult, showTooManySelected, toast]);

  const applyFieldChange = useCallback((fieldId: string, value: BulkFieldValue) => {
    void runBulkRequest(() => fetch("/api/work-items/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        action: "field",
        changes: [{ fieldId, fieldValue: value }],
      }),
    }));
  }, [runBulkRequest, selectedIds]);

  const applyStatusChange = useCallback((statusId: string) => {
    void runBulkRequest(() => fetch("/api/work-items/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        action: "status",
        statusId,
      }),
    }));
  }, [runBulkRequest, selectedIds]);

  const deleteSelected = useCallback(() => {
    void runBulkRequest(() => fetch("/api/work-items/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    }));
  }, [runBulkRequest, selectedIds]);

  return {
    pending,
    applyFieldChange,
    applyStatusChange,
    deleteSelected,
  };
}
