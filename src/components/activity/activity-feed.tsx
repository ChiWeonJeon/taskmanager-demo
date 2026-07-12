"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { UserName } from "@/components/user/user-name";
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
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import { cn } from "@/lib/utils";
import { trackAnalytics } from "@/lib/analytics";
import type { AnalyticsWorkspaceScope } from "@/lib/analytics-core";

interface ActivityActor {
  id: string;
  name: string;
  shortName?: string | null;
  email: string;
  avatarUpdatedAt?: string | null;
}

interface ActivityItem {
  id: string;
  kind: string;
  subjectType: string | null;
  subjectId: string | null;
  payload: Record<string, unknown> | null;
  actor: ActivityActor | null;
  createdAt: string;
  scope?: { type: "project" | "group"; name: string } | null;
}

interface Page {
  items: ActivityItem[];
  nextCursor: string | null;
}

interface Props {
  // 두 endpoint 모두 같은 응답 shape (items + nextCursor) 라 prop 으로 base url 만 받음.
  endpoint: string;
  // queryKey scope 분리 (project vs group). 동일 endpoint 라도 다른 cache.
  scopeKey: string[];
  title?: string;
  description?: string;
  hideHeader?: boolean;
}

export function ActivityFeed({ endpoint, scopeKey, title, description, hideHeader = true }: Props) {
  const { messages } = useI18n();
  const t = messages.activity;
  const [kindFilter, setKindFilter] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);

  const query = useInfiniteQuery<Page>({
    queryKey: ["activity", ...scopeKey, kindFilter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const url = new URL(endpoint, window.location.origin);
      if (pageParam) url.searchParams.set("cursor", pageParam as string);
      if (kindFilter) url.searchParams.set("kind", kindFilter);
      url.searchParams.set("limit", "50");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t.loadFailed);
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allItems = useMemo<ActivityItem[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );

  const kindOptions = useMemo(() => {
    const known = Object.keys(t.kinds);
    return known.map((k) => ({ value: k, label: (t.kinds as Record<string, string>)[k] ?? k }));
  }, [t]);
  const activeFilterCount = kindFilter ? 1 : 0;
  const workspaceScope: AnalyticsWorkspaceScope = scopeKey.includes("project")
    ? "project"
    : scopeKey.includes("group")
      ? "group"
      : scopeKey.some((part) => part === "me" || part === "my")
        ? "personal"
        : "global";

  const updateKindFilter = (nextKind: string) => {
    if (nextKind === kindFilter) return;
    setKindFilter(nextKind);
    trackAnalytics("Activity Filter Changed", {
      activity_kind: nextKind || "all",
      workspace_scope: workspaceScope,
    });
  };

  const renderKindLabel = (kind: string): string => {
    const known = (t.kinds as Record<string, string>)[kind];
    return known ?? t.unknownKind;
  };

  const renderSubjectSummary = (entry: ActivityItem): string | null => {
    if (!entry.payload || typeof entry.payload !== "object") return null;
    const payload = entry.payload;
    if ("title" in payload && typeof payload.title === "string") {
      return "issueKey" in payload && typeof payload.issueKey === "string"
        ? `${payload.issueKey} ${payload.title}`
        : payload.title;
    }
    if ("userName" in payload && typeof payload.userName === "string") {
      return payload.userName;
    }
    if ("name" in payload && typeof payload.name === "string") {
      return payload.name;
    }
    return null;
  };

  const dotClassForKind = (kind: string) =>
    kind.startsWith("member.") ? "bg-[var(--color-cat-member)]" :
    kind.startsWith("settings.") ? "bg-[var(--color-cat-settings)]" :
    kind.startsWith("checklist.") ? "bg-[var(--color-cat-checklist)]" :
    kind.startsWith("workitem.") ? "bg-[var(--color-cat-workitem)]" :
    kind.startsWith("cycle.") ? "bg-[var(--color-cat-calendar)]" :
    "bg-[var(--color-cat-default)]";

  return (
    <section className="flex min-w-0 flex-col gap-3">
      {!hideHeader && (
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{title ?? t.pageTitle}</h1>
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{description ?? t.pageDescription}</p>
        </header>
      )}

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
            <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{t.filterByKind}</p>
            {kindFilter && (
              <button
                type="button"
                onClick={() => updateKindFilter("")}
                className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                {messages.taskWorkspace.resetFilters}
              </button>
            )}
          </div>
          <select
            value={kindFilter}
            onChange={(event) => updateKindFilter(event.target.value)}
            aria-label={t.filterByKind}
            className={cn("mt-2 w-full max-w-xs", featureToolbarSelectClass)}
          >
            <option value="">{t.filterAllKinds}</option>
            {kindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {query.isLoading ? (
        <StateBlock variant="loading" title={t.loading} />
      ) : query.isError ? (
        <StateBlock variant="error" title={t.loadFailed} />
      ) : allItems.length === 0 ? (
        <StateBlock variant="empty" title={t.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          {allItems.map((entry) => {
            const summary = renderSubjectSummary(entry);
            return (
              <li key={entry.id} className="flex items-start gap-3 px-3 py-2 text-[length:var(--text-sm)]">
                <span className={cn(
                  "mt-1 inline-flex h-2 w-2 shrink-0 rounded-full",
                  dotClassForKind(entry.kind),
                )} aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline gap-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                    <span className="font-medium">{renderKindLabel(entry.kind)}</span>
                    {summary && <span className="truncate text-[var(--color-text-secondary)]">{summary}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                    {entry.actor ? (
                      <UserName user={entry.actor} withAvatar avatarSize="xs" truncate={false} />
                    ) : (
                      <span>{t.unknownActor}</span>
                    )}
                    <span>·</span>
                    <DateDisplay date={entry.createdAt} format="full" />
                    {entry.scope && (
                      <>
                        <span>·</span>
                        <span className="min-w-0 truncate rounded-full bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-[length:var(--text-3xs)] font-medium text-[var(--color-text-secondary)]">
                          {entry.scope.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            variant="secondary"
            size="sm"
          >
            {query.isFetchingNextPage ? t.loading : t.loadMore}
          </Button>
        </div>
      )}
    </section>
  );
}
