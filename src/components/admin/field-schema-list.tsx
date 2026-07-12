"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { DateDisplay } from "@/components/shared/date-display";
import { useI18n } from "@/components/shared/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldSchemaFieldEntry } from "@/components/task/types";
import { FIELD_SCHEMA_CANONICAL_ID } from "@/lib/field-schema";
import { useTableControls } from "@/lib/admin/use-table-controls";

interface FieldSchemaRecord {
  id: string;
  name: string;
  createdAt: string;
  fields: FieldSchemaFieldEntry[];
  issueTypes: { id: string; name: string }[];
  objectDefs: { id: string; key: string; name: string }[];
}

export function FieldSchemaList() {
  const router = useRouter();
  const { messages } = useI18n();
  const fs = messages.admin.fieldSchemas;

  const { data: fieldSchemas = [], isPending } = useQuery<FieldSchemaRecord[]>({
    queryKey: ["field-schemas"],
    queryFn: async () => {
      const response = await fetch("/api/field-schemas");
      if (!response.ok) throw new Error(fs.loadFailed);
      return response.json();
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(fieldSchemas, {
    searchAccessor: (s) => s.name,
    sortAccessors: {
      name: (s) => s.name,
      fields: (s) => s.fields.length,
      createdAt: (s) => s.createdAt,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<FieldSchemaRecord>[] = [
    {
      id: "name",
      header: fs.name,
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">{s.name}</span>
          {s.id === FIELD_SCHEMA_CANONICAL_ID && <Badge variant="accent">{fs.locked}</Badge>}
        </div>
      ),
    },
    {
      id: "fields",
      header: fs.fields,
      responsive: "md",
      cell: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.fields.map((entry) => (
            <Badge key={entry.field.id}>{entry.field.name}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: "issueTypes",
      header: fs.issueTypes,
      responsive: "lg",
      cell: (s) =>
        s.issueTypes.length === 0 ? (
          <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{messages.common.none}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {s.issueTypes.map((it) => (
              <Badge key={it.id} variant="warning">
                {it.name}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "objectDefs",
      header: fs.objectDefs,
      responsive: "lg",
      cell: (s) =>
        s.objectDefs.length === 0 ? (
          <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{messages.common.none}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {s.objectDefs.map((objectDef) => (
              <Badge key={objectDef.id} variant="accent">
                {objectDef.name}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "createdAt",
      header: fs.createdAt,
      sortable: true,
      responsive: "lg",
      cell: (s) => <DateDisplay date={s.createdAt} format="compact" />,
    },
  ];

  return (
    <AdminShell
      title={fs.title}
      description={fs.description}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: messages.admin.breadcrumbs.fieldSchemas },
      ]}
      action={
        <Link href="/admin/field-schemas/new">
          <Button size="sm">{fs.create}</Button>
        </Link>
      }
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(s) => s.id}
            isLoading={isPending}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(s) => router.push(`/admin/field-schemas/${s.id}`)}
            getRowHref={(s) => `/admin/field-schemas/${s.id}`}
            emptyState={fs.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}
