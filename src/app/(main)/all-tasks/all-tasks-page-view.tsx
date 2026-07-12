"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskWorkspace } from "@/components/task/task-workspace";
import { useSession } from "next-auth/react";
import { useToast } from "@/lib/toast";
import {
  IssueTypeOption,
  ProjectOption,
  StatusOption,
  WorkItemFieldValue,
  WorkItemUpdate,
  WorkItemWithRelations,
} from "@/components/task/types";
import { fetchJsonWithTimeout } from "@/lib/fetch-json-with-timeout";
import { useI18n } from "@/components/shared/locale-provider";
import { HomeGlobeTabs } from "@/components/layout/home-globe-tabs";
import { resolveTaskWorkspaceMetadata } from "@/lib/task-page-metadata";
import { sortProjectsForUser, UserProjectOrderEntry } from "@/lib/project-sort";

// "모든 일감": 접근 가능한 모든 프로젝트(직접/그룹상속 멤버 ∪ 소유)의 일감.
async function fetchWorkItems() {
  return fetchJsonWithTimeout<WorkItemWithRelations[]>("/api/work-items/accessible");
}

async function fetchStatuses(): Promise<StatusOption[]> {
  return fetchJsonWithTimeout<StatusOption[]>("/api/statuses");
}

async function fetchIssueTypeSummaries(): Promise<IssueTypeOption[]> {
  return fetchJsonWithTimeout<IssueTypeOption[]>("/api/issue-types?view=summary");
}

async function fetchIssueTypes(): Promise<IssueTypeOption[]> {
  return fetchJsonWithTimeout<IssueTypeOption[]>("/api/issue-types");
}

async function fetchProjects(): Promise<ProjectOption[]> {
  return fetchJsonWithTimeout<ProjectOption[]>("/api/projects?memberId=me");
}

export function AllTasksPageView({ variant = "default" }: { variant?: "default" | "today" }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { messages } = useI18n();

  const tasksQuery = useQuery<WorkItemWithRelations[]>({
    queryKey: ["work-items", "all"],
    queryFn: fetchWorkItems,
    enabled: !!session?.user,
    retry: 1,
  });
  const statusesQuery = useQuery<StatusOption[]>({
    queryKey: ["statuses"],
    queryFn: fetchStatuses,
    enabled: !!session?.user,
    retry: 1,
  });
  const issueTypeSummaryQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types", "summary"],
    queryFn: fetchIssueTypeSummaries,
    enabled: !!session?.user,
    retry: 1,
  });
  const issueTypesQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types"],
    queryFn: fetchIssueTypes,
    enabled: !!session?.user,
    retry: 1,
  });
  const projectsQuery = useQuery<ProjectOption[]>({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !!session?.user,
    retry: 1,
  });
  const userProjectOrderQuery = useQuery<UserProjectOrderEntry[]>({
    queryKey: ["user-project-order"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences/project-order");
      return res.ok ? res.json() : [];
    },
    enabled: !!session?.user,
    retry: 1,
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const metadata = useMemo(
    () =>
      resolveTaskWorkspaceMetadata({
        tasks,
        statuses: statusesQuery.data ?? [],
        issueTypes: issueTypesQuery.data ?? issueTypeSummaryQuery.data ?? [],
        projects: projectsQuery.data ?? [],
      }),
    [issueTypeSummaryQuery.data, issueTypesQuery.data, projectsQuery.data, statusesQuery.data, tasks]
  );
  const statuses = metadata.statuses;
  const issueTypes = metadata.issueTypes;
  const projects = useMemo(
    () => sortProjectsForUser(metadata.projects, userProjectOrderQuery.data ?? []),
    [metadata.projects, userProjectOrderQuery.data],
  );
  const isLoading = tasksQuery.isLoading || (tasksQuery.isFetching && !tasksQuery.data);
  const isLoadFailed = tasksQuery.isError;

  const createMutation = useMutation({
    mutationFn: async ({
      title,
      projectId,
      issueTypeId,
    }: {
      title: string;
      projectId?: string;
      issueTypeId?: string;
    }) => {
      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, projectId, issueTypeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create work item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items", "all"] });
      toast(messages.allTasksPage.createSuccess, { type: "success" });
    },
    onError: (error: Error) => toast(error.message || messages.allTasksPage.createError, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/work-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete work item");
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["work-items", "all"] });
      toast(messages.allTasksPage.deleteSuccess, {
        type: "info",
        sticky: true,
        action: {
          label: messages.allTasksPage.restore,
          onClick: async () => {
            await fetch(`/api/work-items/${id}/restore`, { method: "POST" });
            queryClient.invalidateQueries({ queryKey: ["work-items", "all"] });
          },
        },
      });
    },
    onError: () => toast(messages.allTasksPage.deleteError, { type: "error", sticky: true }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: WorkItemUpdate }) => {
      const res = await fetch(`/api/work-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to update work item");
      }
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["work-items", "all"] });
      const previous = queryClient.getQueryData<WorkItemWithRelations[]>(["work-items", "all"]);
      if (previous) {
        queryClient.setQueryData<WorkItemWithRelations[]>(["work-items", "all"], (old) =>
          (old ?? []).map((task) => {
            if (task.id !== id) return task;
            const updated = { ...task };
            if (data.title !== undefined) updated.title = data.title;
            if (data.description !== undefined) updated.description = data.description;
            if (data.startDate !== undefined) updated.startDate = data.startDate;
            if (data.dueDate !== undefined) updated.dueDate = data.dueDate;
            if (data.statusId) {
              updated.statusId = data.statusId;
              const status = statuses.find((s) => s.id === data.statusId);
              if (status) updated.status = { id: status.id, name: status.name, color: status.color, category: status.category };
            }
            if (data.fieldValues) {
              const existingFieldValues = [...(updated.fieldValues ?? [])];
              for (const [fieldId, value] of Object.entries(data.fieldValues)) {
                if (value == null) continue;
                const idx = existingFieldValues.findIndex((fv) => fv.fieldId === fieldId);
                const stringValue = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);
                if (idx >= 0) {
                  existingFieldValues[idx] = { ...existingFieldValues[idx], value: stringValue };
                } else {
                  existingFieldValues.push({ fieldId, value: stringValue, field: {} as WorkItemFieldValue["field"] });
                }
              }
              if (data.clearFieldIds) {
                const clearSet = new Set(data.clearFieldIds);
                updated.fieldValues = existingFieldValues.filter((fv) => !clearSet.has(fv.fieldId));
              } else {
                updated.fieldValues = existingFieldValues;
              }
            }
            return updated;
          })
        );
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items", "all"] });
      toast(messages.allTasksPage.updateSuccess, { type: "success" });
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["work-items", "all"], context.previous);
      }
      toast(err.message || messages.allTasksPage.updateError, { type: "error", sticky: true });
    },
  });

  return (
    <div className="min-w-0 w-full">
      <HomeGlobeTabs section="globe" />
      {isLoadFailed && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {messages.allTasksPage.loadFailed}
          <button
            type="button"
            className="ml-3 rounded border border-[var(--color-danger)] bg-white px-2 py-1 text-xs font-medium hover:bg-[var(--color-danger-light)]"
            onClick={() => {
              tasksQuery.refetch();
              statusesQuery.refetch();
              issueTypeSummaryQuery.refetch();
              issueTypesQuery.refetch();
              projectsQuery.refetch();
            }}
          >
            {messages.common.retry}
          </button>
        </div>
      )}
      <TaskWorkspace
        variant={variant}
        tasks={tasks}
        isLoading={isLoading}
        statuses={statuses}
        issueTypes={issueTypes}
        projects={projects}
        savedViewsWorkspaceKey={variant === "today" ? "tasks:all:today" : "tasks:all"}
        preferenceWorkspaceKey={variant === "today" ? "tasks:all:today" : "tasks:all"}
        onCreateTask={(payload) => createMutation.mutate(payload)}
        createPending={createMutation.isPending}
        onDelete={(id) => deleteMutation.mutate(id)}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["work-items", "all"] })}
      />
    </div>
  );
}
