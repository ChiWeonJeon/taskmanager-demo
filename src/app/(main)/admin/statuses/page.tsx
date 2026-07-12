"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";

type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

interface StatusRecord {
  id: string;
  name: string;
  key: string;
  color: string;
  category: StatusCategory;
  isSystem: boolean;
}

export default function StatusesPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin.statuses;

  const categoryLabels: Record<StatusCategory, string> = {
    TODO: m.categoryTodo,
    IN_PROGRESS: m.categoryInProgress,
    DONE: m.categoryDone,
  };

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["statuses"],
    queryFn: async () => {
      const response = await fetch("/api/statuses");
      if (!response.ok) throw new Error(m.loadFailed);
      return response.json() as Promise<StatusRecord[]>;
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(statuses, {
    searchAccessor: (s) => `${s.name} ${s.key}`,
    sortAccessors: {
      name: (s) => s.name,
      key: (s) => s.key,
      category: (s) => s.category,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<StatusRecord>[] = [
    {
      id: "name",
      header: m.name,
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <Badge color={s.color}>{s.name}</Badge>
          {s.isSystem && <Badge variant="accent">{m.system}</Badge>}
        </div>
      ),
    },
    {
      id: "key",
      header: m.key,
      sortable: true,
      responsive: "sm",
      cell: (s) => <span className="font-mono text-[length:var(--text-xs)]">{s.key}</span>,
    },
    {
      id: "category",
      header: m.category,
      sortable: true,
      responsive: "md",
      cell: (s) => categoryLabels[s.category],
    },
    {
      id: "color",
      header: m.color,
      responsive: "lg",
      cell: (s) => (
        <div className="flex items-center gap-2 text-[length:var(--text-xs)]">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="font-mono">{s.color}</span>
        </div>
      ),
    },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title },
      ]}
      action={
        <Link href="/admin/statuses/new">
          <Button size="sm">{m.create}</Button>
        </Link>
      }
    >
      <div className="space-y-3">
        <AdminListToolbar
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={m.searchPlaceholder}
        />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(s) => router.push(`/admin/statuses/${s.id}`)}
            getRowHref={(s) => `/admin/statuses/${s.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}
