"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { CreateProjectModal } from "@/components/project/create-project-modal";
import { useI18n } from "@/components/shared/locale-provider";
import { AdminTabIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon } from "@/components/task/task-icons";
import { StateBlock } from "@/components/ui/state-block";
import {
  groupProjectsByGroup,
  SortableGroup,
  sortProjectsForUser,
  UserProjectOrderEntry,
} from "@/lib/project-sort";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  groupId?: string | null;
  sortOrderInGroup?: number;
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const { messages } = useI18n();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects?memberId=me");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const { data: myGroups = [] } = useQuery<SortableGroup[]>({
    queryKey: ["my-project-groups"],
    queryFn: async () => {
      const res = await fetch("/api/project-groups?memberId=me");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!session?.user,
  });

  const { data: userOrder = [] } = useQuery<UserProjectOrderEntry[]>({
    queryKey: ["user-project-order"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences/project-order");
      return res.ok ? res.json() : [];
    },
    enabled: !!session?.user,
  });

  const sortedProjects = useMemo(
    () => sortProjectsForUser(projects, userOrder),
    [projects, userOrder],
  );

  const buckets = useMemo(
    () => groupProjectsByGroup(projects, myGroups, userOrder),
    [projects, myGroups, userOrder],
  );

  return (
    <div data-service-page="projects" className="min-w-0 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{messages.projectsPage.title}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {messages.projectsPage.description}
          </p>
        </div>
        {session?.user && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + {messages.projectsPage.createProject}
          </Button>
        )}
      </div>

      {isLoading ? (
        <StateBlock variant="loading" title={messages.commonUi.loadingTitle} />
      ) : sortedProjects.length === 0 ? (
        <StateBlock
          variant="empty"
          title={messages.projectsPage.emptyTitle}
          description={session?.user ? messages.projectsPage.emptyDescription : undefined}
        />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {buckets.map((bucket) => {
              const bucketProjects = sortProjectsForUser(bucket.projects, userOrder);
              if (bucket.group) {
                const collapsed = collapsedGroups[bucket.group.id] ?? false;
                const group = bucket.group;
                return (
                  <div key={group.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({ ...prev, [group.id]: !collapsed }))
                        }
                        aria-label={collapsed ? messages.projectsPage.expand : messages.projectsPage.collapse}
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                      >
                        {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                      </button>
                      <Link
                        href={`/groups/${group.slug}/today`}
                        className="flex-1 truncate text-left text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
                      >
                        <FolderIcon className="mr-1 inline h-4 w-4 align-[-0.125em]" />
                        {group.name}
                      </Link>
                      <span className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                        {bucketProjects.length}
                      </span>
                    </div>
                    {!collapsed && bucketProjects.length > 0 && (
                      <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                        {bucketProjects.map((project) => (
                          <li key={project.id}>
                            <Link
                              href={`/projects/${project.key}/today`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                            >
                              <span className="font-mono text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                                {project.key}
                              </span>
                              <span className="truncate">{project.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              if (bucketProjects.length === 0) return null;
              return (
                <div key="ungrouped" className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  <div className="px-3 py-2 text-[length:var(--text-2xs)] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    {messages.projectsPage.ungrouped}
                  </div>
                  <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                    {bucketProjects.map((project) => (
                      <li key={project.id}>
                        <Link
                          href={`/projects/${project.key}/today`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                        >
                          <span className="font-mono text-[length:var(--text-3xs)] text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                            {project.key}
                          </span>
                          <span className="truncate">{project.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

        <div className={cn("hidden md:grid grid-cols-1 sm:grid-cols-2 gap-3")}>
          {sortedProjects.map((project) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/projects/${project.key}/today`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/projects/${project.key}/today`);
                }
              }}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
                      {project.key}
                    </span>
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {project.name}
                    </h2>
                  </div>
                  {project.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                href={`/projects/${project.key}/admin`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)]"
              >
                  <AdminTabIcon className="h-3.5 w-3.5" />
                  {messages.projectsPage.admin}
                </Link>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
