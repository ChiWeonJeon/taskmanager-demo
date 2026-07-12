"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, GroupIcon } from "@/components/task/task-icons";
import { cn } from "@/lib/utils";
import {
  groupProjectsByGroup,
  SortableGroup,
  SortableProject,
  UserProjectOrderEntry,
  sortProjectsForUser,
} from "@/lib/project-sort";

interface SidebarProject extends SortableProject {
  description?: string | null;
}

interface Props {
  projects: SidebarProject[];
  groups: SortableGroup[];
}

function useUserProjectOrder(enabled: boolean) {
  return useQuery<UserProjectOrderEntry[]>({
    queryKey: ["user-project-order"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences/project-order");
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
  });
}

export function SidebarProjectList({ projects, groups }: Props) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: userOrder = [] } = useUserProjectOrder(projects.length > 0);

  // Local overrides only — SSR/CSR 일관성 유지를 위해 기본은 펼침, 이후 토글/새로고침 시 localStorage 반영
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const isCollapsed = (groupId: string): boolean => {
    if (groupId in collapsedOverrides) return collapsedOverrides[groupId];
    return false;
  };

  const buckets = useMemo(
    () => groupProjectsByGroup(projects, groups, userOrder),
    [projects, groups, userOrder],
  );

  // Flat ordered project list used to persist when dragging within a bucket.
  const flatOrder = useMemo(() => buckets.flatMap((bucket) => bucket.projects.map((p) => p.id)), [buckets]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const saveOrder = useMutation({
    mutationFn: async (order: string[]) => {
      const res = await fetch("/api/user/preferences/project-order", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error("Failed to save order");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-project-order"] });
    },
  });

  function toggleGroup(groupId: string) {
    setCollapsedOverrides((prev) => {
      const nextValue = !isCollapsed(groupId);
      const next = { ...prev, [groupId]: nextValue };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`sidebar-group-collapsed:${groupId}`, String(nextValue));
      }
      return next;
    });
  }

  function handleDrop(targetId: string, bucketProjects: SidebarProject[]) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const bucketIds = bucketProjects.map((p) => p.id);
    if (!bucketIds.includes(dragId) || !bucketIds.includes(targetId)) {
      // cross-bucket DnD not supported
      setDragId(null);
      setOverId(null);
      return;
    }

    const nextBucket = [...bucketIds];
    const from = nextBucket.indexOf(dragId);
    const to = nextBucket.indexOf(targetId);
    nextBucket.splice(from, 1);
    const insertAt = from < to ? to : to;
    nextBucket.splice(insertAt, 0, dragId);

    const nextFlat: string[] = [];
    let usedBucket = false;
    for (const id of flatOrder) {
      if (bucketIds.includes(id)) {
        if (!usedBucket) {
          nextFlat.push(...nextBucket);
          usedBucket = true;
        }
      } else {
        nextFlat.push(id);
      }
    }
    if (!usedBucket) nextFlat.push(...nextBucket);

    setDragId(null);
    setOverId(null);
    saveOrder.mutate(nextFlat);
  }

  const isPathActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  function renderProjects(bucketProjects: SidebarProject[]) {
    const sorted = sortProjectsForUser(bucketProjects, userOrder);
    return sorted.map((project) => (
      <Link
        key={project.id}
        href={`/projects/${project.key}/today`}
        draggable
        onDragStart={(e) => {
          setDragId(project.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (dragId && dragId !== project.id) {
            e.preventDefault();
            setOverId(project.id);
          }
        }}
        onDragLeave={() => {
          if (overId === project.id) setOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(project.id, sorted);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-2xs)] transition-colors",
          isPathActive(`/projects/${project.key}`)
            ? "text-[var(--color-accent)] bg-[var(--color-accent-light)]"
            : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
          dragId === project.id && "opacity-40",
          overId === project.id && dragId !== project.id && "ring-1 ring-[var(--color-accent)]",
        )}
      >
        <span className="font-mono text-[length:var(--text-3xs)] bg-[var(--color-bg-tertiary)] px-1 rounded">{project.key}</span>
        <span className="truncate">{project.name}</span>
      </Link>
    ));
  }

  return (
    <div className="ml-4 mt-1 space-y-1">
      {buckets.map((bucket) => {
        if (bucket.group) {
          const collapsed = isCollapsed(bucket.group.id);
          return (
            <div key={bucket.group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(bucket.group!.id)}
                className="flex w-full items-center gap-1 rounded-[var(--radius-md)] px-1 py-0.5 text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <ChevronRightIcon className={cn("h-3 w-3 transition-transform", !collapsed && "rotate-90")} />
                <Link
                  href={`/groups/${bucket.group.slug}/today`}
                  className="flex flex-1 items-center gap-1 truncate text-left hover:text-[var(--color-accent)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GroupIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{bucket.group.name}</span>
                </Link>
              </button>
              {!collapsed && <div className="ml-3 space-y-0.5">{renderProjects(bucket.projects)}</div>}
            </div>
          );
        }
        if (bucket.projects.length === 0) return null;
        return (
          <div key="ungrouped" className="space-y-0.5">
            {renderProjects(bucket.projects)}
          </div>
        );
      })}
    </div>
  );
}
