"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";

interface AdminProject {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  workItemCount: number;
  owner: { id: string; name: string; email: string } | null;
}

export default function AdminProjectsPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.adminProjectsPage;

  const { data: projects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async (): Promise<AdminProject[]> => {
      const res = await fetch("/api/admin/projects");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  const totalCount = projects.length;
  const personalCount = projects.filter((p) => p.isPersonal).length;
  const sharedCount = totalCount - personalCount;

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(projects, {
    searchAccessor: (p) => `${p.name} ${p.key} ${p.owner?.name ?? ""}`,
    sortAccessors: {
      key: (p) => p.key,
      name: (p) => p.name,
      members: (p) => p.memberCount,
      issues: (p) => p.workItemCount,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<AdminProject>[] = [
    { id: "key", header: m.colKey, sortable: true, responsive: "sm", cell: (p) => <span className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{p.key}</span> },
    { id: "name", header: m.colName, sortable: true, cell: (p) => <span className="font-medium text-[var(--color-text-primary)]">{p.name}</span> },
    { id: "type", header: m.colType, responsive: "md", cell: (p) => <Badge variant={p.isPersonal ? "default" : "accent"}>{p.isPersonal ? m.personalBadge : m.sharedBadge}</Badge> },
    { id: "owner", header: m.colOwner, responsive: "md", cell: (p) => <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{p.owner?.name ?? messages.commonUi.unassigned}</span> },
    { id: "members", header: m.colMembers, sortable: true, align: "right", responsive: "lg", cell: (p) => p.memberCount },
    { id: "issues", header: m.colIssues, sortable: true, align: "right", responsive: "lg", cell: (p) => p.workItemCount },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.title }]}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: m.statTotal, value: totalCount },
          { label: m.statShared, value: sharedCount },
          { label: m.statPersonal, value: personalCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
            <div className="text-xs text-[var(--color-text-tertiary)]">{stat.label}</div>
            <div className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{stat.value}</div>
          </div>
        ))}
      </div>

      {isError && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {m.loadFailed}
          <button type="button" className="ml-3 rounded border border-[var(--color-danger)] bg-white px-2 py-1 text-xs font-medium hover:bg-[var(--color-danger-light)]" onClick={() => refetch()}>
            {m.retry}
          </button>
        </div>
      )}

      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(p) => router.push(`/admin/projects/${p.id}`)}
            getRowHref={(p) => `/admin/projects/${p.id}`}
            emptyState={m.emptyList}
          />
        </div>
      </div>
    </AdminShell>
  );
}
