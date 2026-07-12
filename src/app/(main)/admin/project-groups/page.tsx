"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { DateDisplay } from "@/components/shared/date-display";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";

interface AdminProjectGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  _count: { projects: number; members: number };
}

export default function AdminProjectGroupsPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.adminProjectGroupsPage;

  const { data: groups = [], isLoading } = useQuery<AdminProjectGroup[]>({
    queryKey: ["admin-project-groups"],
    queryFn: async () => {
      const res = await fetch("/api/admin/project-groups");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(groups, {
    searchAccessor: (g) => `${g.name} ${g.slug} ${g.owner?.name ?? ""}`,
    sortAccessors: {
      slug: (g) => g.slug,
      name: (g) => g.name,
      projects: (g) => g._count.projects,
      members: (g) => g._count.members,
      createdAt: (g) => g.createdAt,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<AdminProjectGroup>[] = [
    {
      id: "slug",
      header: m.colSlug,
      sortable: true,
      responsive: "sm",
      cell: (g) => (
        <Link
          href={`/groups/${g.slug}/today`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
        >
          {g.slug}
        </Link>
      ),
    },
    {
      id: "name",
      header: m.colName,
      sortable: true,
      cell: (g) => <span className="font-medium text-[var(--color-text-primary)]">{g.name}</span>,
    },
    {
      id: "owner",
      header: m.colOwner,
      responsive: "md",
      cell: (g) => (
        <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
          {g.owner ? `${g.owner.name}` : "—"}
        </span>
      ),
    },
    { id: "projects", header: m.colProjects, sortable: true, align: "right", responsive: "sm", cell: (g) => g._count.projects },
    { id: "members", header: m.colMembers, sortable: true, align: "right", responsive: "sm", cell: (g) => g._count.members },
    {
      id: "createdAt",
      header: m.colCreatedAt,
      sortable: true,
      responsive: "lg",
      cell: (g) => <DateDisplay date={g.createdAt} format="date" />,
    },
  ];

  return (
    <AdminShell
      title={m.pageTitle}
      description={m.description}
      breadcrumbs={[{ href: "/admin", label: messages.admin.breadcrumbs.admin }, { label: m.breadcrumb }]}
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(g) => g.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(g) => router.push(`/admin/project-groups/${g.id}`)}
            getRowHref={(g) => `/admin/project-groups/${g.id}`}
            emptyState={m.empty}
          />
        </div>
      </div>
    </AdminShell>
  );
}
