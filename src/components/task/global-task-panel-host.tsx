"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ReadonlyURLSearchParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import type {
  IssueTypeOption,
  ProjectOption,
  StatusOption,
  WorkItemUpdate,
  WorkItemWithRelations,
} from "@/components/task/types";
import { useToast } from "@/lib/toast";
import { useI18n } from "@/components/shared/locale-provider";
import { trackAnalytics } from "@/lib/analytics";
import { routeMetadata } from "@/lib/analytics-core";

function pathOwnsTaskPanel(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return true;
  if (/^\/groups\/[^/]+\/tasks/.test(pathname)) return true;
  if (/^\/projects\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function GlobalTaskPanelHost() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams?.get("task") ?? null;

  if (!taskId || pathOwnsTaskPanel(pathname)) return null;

  // `key={taskId}` remounts the boundary whenever the URL switches to a new
  // task. Each fresh mount resets `open` to true so every notification click
  // guarantees the panel opens — even if the previous close hasn't fully
  // propagated through the router yet.
  return (
    <TaskPanelBoundary
      key={taskId}
      taskId={taskId}
      pathname={pathname}
      searchParams={searchParams}
    />
  );
}

interface BoundaryProps {
  taskId: string;
  pathname: string | null;
  searchParams: ReadonlyURLSearchParams | null;
}

function TaskPanelBoundary({ taskId, pathname, searchParams }: BoundaryProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const [open, setOpen] = useState(true);
  const erroredRef = useRef(false);
  const trackedTaskRef = useRef<string | null>(null);

  const taskQuery = useQuery<WorkItemWithRelations>({
    queryKey: ["work-item-detail", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/work-items/${taskId}`);
      if (!res.ok) throw new Error("Failed to load work item");
      return res.json();
    },
    enabled: open,
    staleTime: 0,
  });

  const statusesQuery = useQuery<StatusOption[]>({
    queryKey: ["statuses"],
    queryFn: async () => {
      const res = await fetch("/api/statuses");
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    },
    enabled: open,
  });

  const issueTypesQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types"],
    queryFn: async () => {
      const res = await fetch("/api/issue-types");
      if (!res.ok) throw new Error("Failed to fetch issue types");
      return res.json();
    },
    enabled: open,
  });

  const projectsQuery = useQuery<ProjectOption[]>({
    queryKey: ["projects-for-detail"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: open,
  });

  const task = taskQuery.data ?? null;
  const allTasks = useMemo<WorkItemWithRelations[]>(() => (task ? [task] : []), [task]);

  useEffect(() => {
    if (!task || trackedTaskRef.current === task.id) return;
    trackedTaskRef.current = task.id;
    trackAnalytics("Task Opened", {
      issue_type: task.issueType.key ?? task.issueType.name,
      project_key: task.project?.key ?? "none",
      source_view: "deep_link",
      workspace_scope: routeMetadata(pathname ?? "/").workspaceScope,
    });
  }, [pathname, task]);

  useEffect(() => {
    if (!taskQuery.error || erroredRef.current) return;
    erroredRef.current = true;
    toast(messages.errors.workItemNotFound, { type: "error" });
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("task");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname ?? "/", { scroll: false });
  }, [taskQuery.error, toast, messages.errors.workItemNotFound, router, pathname, searchParams]);

  const handleClose = () => {
    // Hide immediately — don't wait for URL propagation.
    setOpen(false);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("task");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname ?? "/", { scroll: false });
  };

  const handleUpdate = async (id: string, updates: WorkItemUpdate) => {
    const res = await fetch(`/api/work-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to update work item");
    }
    const updated = (await res.json()) as WorkItemWithRelations;
    queryClient.setQueryData(["work-item-detail", id], updated);
    queryClient.invalidateQueries({ queryKey: ["work-item-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["work-items"] });
  };

  if (!open || !task) return null;

  return (
    <TaskDetailPanel
      task={task}
      allTasks={allTasks}
      statuses={statusesQuery.data ?? []}
      issueTypes={issueTypesQuery.data ?? []}
      projects={projectsQuery.data ?? []}
      scrollRequest={null}
      onClose={handleClose}
      onUpdate={handleUpdate}
    />
  );
}
