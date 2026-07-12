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

type FieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTI_SELECT"
  | "OBJECT_REF"
  | "MULTI_OBJECT_REF"
  | "ENTITY_REF"
  | "MULTI_ENTITY_REF"
  | "REFERENCE"
  | "MULTI_REFERENCE"
  | "USER"
  | "URL";

interface FieldRecord {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  options: string | null;
  defaultValue: string | null;
  isSystem: boolean;
}

interface FieldOption {
  value: string;
  label: string;
  color?: string | null;
}

function parseOptions(raw: string | null): FieldOption[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (o): o is FieldOption =>
            typeof o === "object" && o !== null && typeof (o as FieldOption).value === "string" && typeof (o as FieldOption).label === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function FieldsAdminPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.adminFieldsPage;

  const { data: fields = [], isLoading } = useQuery<FieldRecord[]>({
    queryKey: ["fields"],
    queryFn: async () => {
      const r = await fetch("/api/fields");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(fields, {
    searchAccessor: (f) => `${f.name} ${f.key}`,
    sortAccessors: {
      name: (f) => f.name,
      key: (f) => f.key,
      type: (f) => f.type,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<FieldRecord>[] = [
    {
      id: "name",
      header: m.nameLabel,
      sortable: true,
      cell: (f) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">{f.name}</span>
          {f.isSystem && <Badge variant="accent">{m.systemBadge}</Badge>}
        </div>
      ),
    },
    { id: "key", header: m.keyLabel, sortable: true, responsive: "sm", cell: (f) => <span className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{f.key}</span> },
    { id: "type", header: m.typeLabel, sortable: true, cell: (f) => <Badge>{f.type}</Badge> },
    {
      id: "options",
      header: m.optionsTitle,
      responsive: "lg",
      cell: (f) => {
        const options = parseOptions(f.options);
        if (options.length === 0) return <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {options.map((o) => (
              <Badge key={o.value} color={o.color ?? undefined}>
                {o.label}
              </Badge>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <AdminShell
      title={m.pageTitle}
      description={m.pageDescription}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.pageTitle }]}
      action={
        <Link href="/admin/fields/new">
          <Button size="sm">{m.createTitle}</Button>
        </Link>
      }
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(f) => f.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(f) => router.push(`/admin/fields/${f.id}`)}
            getRowHref={(f) => `/admin/fields/${f.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}

export default function FieldsPage() {
  return <FieldsAdminPage />;
}
