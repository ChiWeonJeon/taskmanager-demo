"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import {
  FeatureToolbar,
  featureToolbarBadgeClass,
  featureToolbarButtonActiveClass,
  featureToolbarButtonClass,
  featureToolbarLabelClass,
  featureToolbarPanelClass,
  featureToolbarSelectClass,
} from "@/components/layout/feature-toolbar";
import { FilterIcon } from "@/components/task/task-icons";
import { StateBlock } from "@/components/ui/state-block";
import { cn } from "@/lib/utils";

interface Props {
  groupSlug: string;
}

interface ProjectRef {
  id: string;
  key: string;
  name: string;
  sortOrderInGroup: number;
}

interface UserRef {
  id: string;
  name: string;
  email: string;
}

interface Row {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  createdBy: UserRef;
  project: { id: string; key: string; name: string };
  _count: { items: number; runs: number };
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    startedBy: UserRef;
  }>;
}

export function GroupChecklists({ groupSlug }: Props) {
  const { messages } = useI18n();
  const t = messages.groupChecklistsPage;
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "running">("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const query = useQuery<{ projects: ProjectRef[]; checklists: Row[] }>({
    queryKey: ["group-checklists", groupSlug, projectFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectFilter) params.set("projectId", projectFilter);
      if (statusFilter === "running") params.set("status", "running");
      const res = await fetch(`/api/project-groups/${groupSlug}/checklists?${params.toString()}`);
      if (!res.ok) throw new Error(t.loadFailed);
      return res.json();
    },
  });

  const grouped = useMemo(() => {
    if (!query.data) return new Map<string, { project: ProjectRef; rows: Row[] }>();
    const out = new Map<string, { project: ProjectRef; rows: Row[] }>();
    for (const p of query.data.projects) {
      out.set(p.id, { project: p, rows: [] });
    }
    for (const c of query.data.checklists) {
      const cell = out.get(c.projectId);
      if (cell) cell.rows.push(c);
    }
    return out;
  }, [query.data]);
  const activeFilterCount = (projectFilter ? 1 : 0) + (statusFilter === "running" ? 1 : 0);

  return (
    <div className="space-y-3">
      <FeatureToolbar>
        <button
          type="button"
          onClick={() => setFilterOpen((current) => !current)}
          aria-label={messages.taskWorkspace.filter}
          title={messages.taskWorkspace.filter}
          aria-expanded={filterOpen}
          className={cn(featureToolbarButtonClass, (filterOpen || activeFilterCount > 0) && featureToolbarButtonActiveClass)}
        >
          <FilterIcon className="h-3.5 w-3.5" />
          <span className={featureToolbarLabelClass}>{messages.taskWorkspace.filter}</span>
          {activeFilterCount > 0 && (
            <span className={featureToolbarBadgeClass}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </FeatureToolbar>

      {filterOpen && (
        <div className={featureToolbarPanelClass}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{messages.taskWorkspace.filterConditions}</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setProjectFilter("");
                  setStatusFilter("all");
                }}
                className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                {messages.taskWorkspace.resetFilters}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={cn("w-full max-w-xs", featureToolbarSelectClass)}
              aria-label={t.filterAll}
            >
              <option value="">{t.filterAll}</option>
              {query.data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "running")}
              className={cn("w-full max-w-xs", featureToolbarSelectClass)}
              aria-label={t.filterStatusAll}
            >
              <option value="all">{t.filterStatusAll}</option>
              <option value="running">{t.filterStatusRunning}</option>
            </select>
          </div>
        </div>
      )}

      {query.isError && (
        <StateBlock variant="error" title={t.loadFailed} />
      )}

      {query.data && Array.from(grouped.values()).every((g) => g.rows.length === 0) && (
        <StateBlock variant="empty" title={t.empty} />
      )}

      <div className="space-y-4">
        {Array.from(grouped.values()).map(({ project, rows }) => {
          if (rows.length === 0) return null;
          return (
            <section key={project.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                  {project.key.toLowerCase()}
                </span>
                <h2 className="text-[length:var(--text-base)] font-semibold text-[var(--color-text-primary)]">{project.name}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((r) => (
                  <Link
                    key={r.id}
                    href={`/projects/${r.project.key}/checklists/${r.id}`}
                    className="rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-3 hover:bg-[var(--color-bg-hover)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
                        {r.title}
                      </h3>
                      {r.runs[0] && (
                        <span className="shrink-0 rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[length:var(--text-3xs)] font-medium text-[var(--color-accent)]">
                          {t.runningBadge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                      <span>{t.itemsCount.replace("{count}", String(r._count.items))}</span>
                      <span>·</span>
                      <span>{t.runsCount.replace("{count}", String(r._count.runs))}</span>
                      <span>·</span>
                      <DateDisplay date={r.createdAt} format="compact" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
