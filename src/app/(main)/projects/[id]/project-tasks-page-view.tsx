"use client";

import { use, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskWorkspace } from "@/components/task/task-workspace";
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
import { resolveTaskWorkspaceMetadata } from "@/lib/task-page-metadata";

export function ProjectTasksPageView({
  params,
  variant = "default",
}: {
  params: Promise<{ id: string }>;
  variant?: "default" | "today";
}) {
  const { id: projectKey } = use(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();

  const tasksQuery = useQuery<WorkItemWithRelations[]>({
    queryKey: ["work-items", "project", projectKey],
    queryFn: () => fetchJsonWithTimeout<WorkItemWithRelations[]>(`/api/work-items?projectKey=${projectKey}`),
    retry: 1,
  });

  const statusesQuery = useQuery<StatusOption[]>({
    queryKey: ["statuses"],
    queryFn: () => fetchJsonWithTimeout<StatusOption[]>("/api/statuses"),
    retry: 1,
  });

  const issueTypeSummaryQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types", "summary"],
    queryFn: () => fetchJsonWithTimeout<IssueTypeOption[]>("/api/issue-types?view=summary"),
    retry: 1,
  });

  const issueTypesQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types"],
    queryFn: () => fetchJsonWithTimeout<IssueTypeOption[]>("/api/issue-types"),
    retry: 1,
  });

  const projectsQuery = useQuery<ProjectOption[]>({
    queryKey: ["my-projects"],
    queryFn: () => fetchJsonWithTimeout<ProjectOption[]>("/api/projects?memberId=me"),
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
  const projects = metadata.projects;
  const isLoading = tasksQuery.isLoading || (tasksQuery.isFetching && !tasksQuery.data);
  const isLoadFailed = tasksQuery.isError;

  const currentProject = projects.find((project) => project.key === projectKey) ?? null;

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
      if (!currentProject?.id) throw new Error("Project not found");
      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          projectId: projectId ?? currentProject.id,
          issueTypeId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create work item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items", "project", projectKey] });
      toast(messages.projectTasksPage.createSuccess, { type: "success" });
    },
    onError: (error: Error) => toast(error.message || messages.projectTasksPage.createError, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/work-items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete work item");
    },
    onSuccess: (_data, itemId) => {
      queryClient.invalidateQueries({ queryKey: ["work-items", "project", projectKey] });
      queryClient.invalidateQueries({ queryKey: ["trash", projectKey] });
      toast(messages.projectTasksPage.deleteSuccess, {
        type: "info",
        sticky: true,
        action: {
          label: messages.projectTasksPage.restore,
          onClick: async () => {
            await fetch(`/api/work-items/${itemId}/restore`, { method: "POST" });
            queryClient.invalidateQueries({ queryKey: ["work-items", "project", projectKey] });
            queryClient.invalidateQueries({ queryKey: ["trash", projectKey] });
          },
        },
      });
    },
    onError: () => toast(messages.projectTasksPage.deleteError, { type: "error", sticky: true }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: WorkItemUpdate }) => {
      const res = await fetch(`/api/work-items/${itemId}`, {
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
    onMutate: async ({ itemId, data }) => {
      const queryKey = ["work-items", "project", projectKey];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkItemWithRelations[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<WorkItemWithRelations[]>(queryKey, (old) =>
          (old ?? []).map((task) => {
            if (task.id !== itemId) return task;
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
      queryClient.invalidateQueries({ queryKey: ["work-items", "project", projectKey] });
      toast(messages.projectTasksPage.updateSuccess, { type: "success" });
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["work-items", "project", projectKey], context.previous);
      }
      toast(err.message || messages.projectTasksPage.updateError, { type: "error", sticky: true });
    },
  });

  return (
    <>
      {isLoadFailed && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {messages.projectTasksPage.loadFailed}
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
        savedViewsWorkspaceKey={`tasks:project:${currentProject?.id ?? projectKey}${variant === "today" ? ":today" : ""}`}
        preferenceWorkspaceKey={`tasks:project:${projectKey}${variant === "today" ? ":today" : ""}`}
        workspaceProjectId={currentProject?.id}
        defaultCreateProjectId={currentProject?.id}
        onCreateTask={(payload) => createMutation.mutate(payload)}
        createPending={createMutation.isPending}
        onDelete={(itemId) => deleteMutation.mutate(itemId)}
        onUpdate={(itemId, data) => updateMutation.mutate({ itemId, data })}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["work-items", "project", projectKey] })}
      />
    </>
  );
}
