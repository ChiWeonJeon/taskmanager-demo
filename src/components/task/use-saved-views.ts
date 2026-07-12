"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskSavedViewConfig, TaskSavedViewDto } from "@/lib/task-saved-view";

export interface TaskSavedViewsResponse {
  views: TaskSavedViewDto[];
  defaultViewId: string | null;
}

export interface CreateTaskSavedViewInput {
  workspaceKey: string;
  name: string;
  isShared: boolean;
  config: TaskSavedViewConfig;
}

export interface UpdateTaskSavedViewInput {
  id: string;
  name?: string;
  isShared?: boolean;
  config?: TaskSavedViewConfig;
}

export const taskSavedViewsQueryKey = (workspaceKey: string) => ["task-saved-views", workspaceKey] as const;

async function readApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function useSavedViews(workspaceKey: string, enabled: boolean, loadErrorMessage: string) {
  return useQuery<TaskSavedViewsResponse>({
    queryKey: taskSavedViewsQueryKey(workspaceKey),
    enabled: enabled && Boolean(workspaceKey),
    queryFn: async () => {
      const response = await fetch(`/api/saved-views?workspaceKey=${encodeURIComponent(workspaceKey)}`);
      if (!response.ok) throw new Error(await readApiError(response, loadErrorMessage));
      return response.json() as Promise<TaskSavedViewsResponse>;
    },
  });
}

export function useSavedViewMutations(workspaceKey: string, messages: {
  createFailed: string;
  updateFailed: string;
  deleteFailed: string;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: taskSavedViewsQueryKey(workspaceKey) });

  const createView = useMutation({
    mutationFn: async (input: CreateTaskSavedViewInput) => {
      const response = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await readApiError(response, messages.createFailed));
      return response.json() as Promise<TaskSavedViewDto>;
    },
    onSuccess: invalidate,
  });

  const updateView = useMutation({
    mutationFn: async (input: UpdateTaskSavedViewInput) => {
      const response = await fetch(`/api/saved-views/${encodeURIComponent(input.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await readApiError(response, messages.updateFailed));
      return response.json() as Promise<TaskSavedViewDto>;
    },
    onSuccess: invalidate,
  });

  const deleteView = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/saved-views/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readApiError(response, messages.deleteFailed));
      return true;
    },
    onSuccess: invalidate,
  });

  const setDefaultView = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await fetch("/api/saved-views/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewId }),
      });
      if (!response.ok) throw new Error(await readApiError(response, messages.updateFailed));
      return response.json() as Promise<TaskSavedViewDto>;
    },
    onSuccess: invalidate,
  });

  const clearDefaultView = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/saved-views/default?workspaceKey=${encodeURIComponent(workspaceKey)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readApiError(response, messages.updateFailed));
      return true;
    },
    onSuccess: invalidate,
  });

  return {
    createView,
    updateView,
    deleteView,
    setDefaultView,
    clearDefaultView,
  };
}
