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

interface StatusSchemaRecord {
  id: string;
  name: string;
  startStatus?: { id: string; name: string } | null;
  startStatusId?: string | null;
  statuses: { status: { id: string; name: string } }[];
  issueTypes: { id: string; name: string }[];
}

export function StatusSchemasAdminPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin.statusSchemas;

  const { data: schemas = [], isLoading } = useQuery({
    queryKey: ["status-schemas"],
    queryFn: async () => {
      const r = await fetch("/api/status-schemas");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json() as Promise<StatusSchemaRecord[]>;
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(schemas, {
    searchAccessor: (s) => s.name,
    sortAccessors: {
      name: (s) => s.name,
      statuses: (s) => s.statuses.length,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<StatusSchemaRecord>[] = [
    {
      id: "name",
      header: m.schemaName,
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">{s.name}</span>
          {s.issueTypes.length > 0 && (
            <Badge variant="accent">{s.issueTypes.length} {messages.admin.fieldSchemas.issueTypes}</Badge>
          )}
        </div>
      ),
    },
    { id: "statuses", header: m.colStatuses, sortable: true, align: "right", responsive: "sm", cell: (s) => s.statuses.length },
    {
      id: "startStatus",
      header: m.startStatus,
      responsive: "md",
      cell: (s) => <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{s.startStatus?.name ?? "—"}</span>,
    },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.title }]}
      action={
        <Link href="/admin/status-schemas/new">
          <Button size="sm">{m.create}</Button>
        </Link>
      }
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(s) => router.push(`/admin/status-schemas/${s.id}`)}
            getRowHref={(s) => `/admin/status-schemas/${s.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}

export default function StatusSchemasPage() {
  return <StatusSchemasAdminPage />;
}
