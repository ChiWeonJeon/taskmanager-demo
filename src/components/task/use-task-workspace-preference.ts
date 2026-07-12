"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TaskWorkspacePreferenceDto,
  TaskWorkspacePreferenceInput,
} from "@/lib/task-workspace-preference";

export const taskWorkspacePreferenceQueryKey = (workspaceKey: string) =>
  ["task-workspace-preference", workspaceKey] as const;

export function useTaskWorkspacePreference(workspaceKey: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery<TaskWorkspacePreferenceDto>({
    queryKey: taskWorkspacePreferenceQueryKey(workspaceKey),
    enabled: enabled && Boolean(workspaceKey),
    queryFn: async () => {
      const response = await fetch(`/api/user/preferences/task-workspace?workspaceKey=${encodeURIComponent(workspaceKey)}`);
      if (!response.ok) throw new Error("TASK_WORKSPACE_PREFERENCE_LOAD_FAILED");
      return response.json() as Promise<TaskWorkspacePreferenceDto>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (preference: TaskWorkspacePreferenceInput) => {
      const response = await fetch("/api/user/preferences/task-workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceKey, ...preference }),
      });
      if (!response.ok) throw new Error("TASK_WORKSPACE_PREFERENCE_SAVE_FAILED");
      return response.json() as Promise<TaskWorkspacePreferenceDto>;
    },
    onSuccess: (preference) => {
      queryClient.setQueryData(taskWorkspacePreferenceQueryKey(workspaceKey), preference);
    },
  });

  return { query, save: mutation.mutateAsync, mutation };
}
