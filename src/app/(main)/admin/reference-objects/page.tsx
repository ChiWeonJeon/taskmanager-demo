"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AdminShell } from "@/components/admin/admin-shell";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/locale-provider";
import { useTableControls } from "@/lib/admin/use-table-controls";

interface ReferenceObjectRecord {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  _count?: { records: number };
}

export default function ReferenceObjectsPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin.objectTypes;

  const { data: referenceObjects = [], isLoading } = useQuery<ReferenceObjectRecord[]>({
    queryKey: ["reference-objects", "admin"],
    queryFn: async () => {
      const response = await fetch("/api/reference-objects?all=1");
      if (!response.ok) throw new Error(m.loadFailed);
      return response.json();
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(referenceObjects, {
    searchAccessor: (objectDef) => `${objectDef.name} ${objectDef.key}`,
    sortAccessors: {
      name: (objectDef) => objectDef.name,
      key: (objectDef) => objectDef.key,
      recordCount: (objectDef) => objectDef._count?.records ?? 0,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<ReferenceObjectRecord>[] = [
    {
      id: "name",
      header: m.name,
      sortable: true,
      cell: (objectDef) => (
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]"
            style={objectDef.color ? { backgroundColor: objectDef.color, color: "#ffffff" } : undefined}
          >
            {objectDef.icon || objectDef.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate font-medium text-[var(--color-text-primary)]">{objectDef.name}</span>
          {objectDef.isSystem && <Badge variant="accent">{m.system}</Badge>}
        </div>
      ),
    },
    {
      id: "key",
      header: m.key,
      sortable: true,
      responsive: "sm",
      cell: (objectDef) => (
        <span className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
          {objectDef.key}
        </span>
      ),
    },
    {
      id: "recordCount",
      header: m.recordCount,
      sortable: true,
      responsive: "md",
      cell: (objectDef) => <Badge>{objectDef._count?.records ?? 0}</Badge>,
    },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.title }]}
      action={
        <Link href="/admin/reference-objects/new">
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
            rowKey={(objectDef) => objectDef.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(objectDef) => router.push(`/admin/reference-objects/${encodeURIComponent(objectDef.key)}`)}
            getRowHref={(objectDef) => `/admin/reference-objects/${encodeURIComponent(objectDef.key)}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}
