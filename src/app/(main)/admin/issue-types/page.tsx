"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { FieldSchemaOption, IssueTypeOption, StatusSchemaOption } from "@/components/task/types";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";
import { getIssueTypeScopeLabel } from "@/components/task/issue-type-label";

type EntityCategory = "ISSUE" | "CYCLE";

const ENTITY_CATEGORY_TABS: EntityCategory[] = ["ISSUE", "CYCLE"];

function getEntityCategoryLabel(messages: ReturnType<typeof useI18n>["messages"], category: EntityCategory) {
  if (category === "CYCLE") return messages.entityTypeScopes.cycle;
  return messages.entityTypeScopes.issue;
}

export function IssueTypesAdminPage({
  apiBase = "/api/issue-types",
  listPath = "/admin/issue-types",
  queryKey = ["issue-types"],
  messagesKind = "issueTypes",
}: {
  apiBase?: string;
  listPath?: string;
  queryKey?: string[];
  messagesKind?: "issueTypes" | "entityTypes";
}) {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin[messagesKind];
  const isEntityTypes = messagesKind === "entityTypes";
  const [activeCategory, setActiveCategory] = useState<EntityCategory>("ISSUE");

  const { data: issueTypes = [], isLoading } = useQuery<IssueTypeOption[]>({
    queryKey: isEntityTypes ? [...queryKey, activeCategory] : queryKey,
    queryFn: async () => {
      const url = isEntityTypes ? `${apiBase}?category=${activeCategory}` : apiBase;
      const r = await fetch(url);
      if (!r.ok) throw new Error(m.requestFailed);
      return r.json();
    },
  });
  const { data: fieldSchemas = [] } = useQuery<FieldSchemaOption[]>({
    queryKey: ["field-schemas"],
    queryFn: async () => {
      const r = await fetch("/api/field-schemas");
      if (!r.ok) throw new Error(m.requestFailed);
      return r.json();
    },
  });
  const { data: statusSchemas = [] } = useQuery<StatusSchemaOption[]>({
    queryKey: ["status-schemas"],
    queryFn: async () => {
      const r = await fetch("/api/status-schemas");
      if (!r.ok) throw new Error(m.requestFailed);
      return r.json();
    },
  });

  const fieldSchemaName = (id: string) => fieldSchemas.find((s) => s.id === id)?.name ?? m.unknownSchema;
  const statusSchemaName = (id: string | null) => id ? statusSchemas.find((s) => s.id === id)?.name ?? m.unknownSchema : m.noStatusSchema;

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(issueTypes, {
    searchAccessor: (it) => it.name,
    sortAccessors: { name: (it) => it.name },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<IssueTypeOption>[] = [
    {
      id: "name",
      header: m.name,
      sortable: true,
      cell: (it) => (
        <div className="flex items-center gap-2">
          {it.icon && <span aria-hidden>{it.icon}</span>}
          <Badge color={it.color || undefined}>{it.name}</Badge>
          {it.projectLinks && it.projectLinks.length > 0 && (
            <Badge variant="accent">{it.projectLinks.length} {m.projects}</Badge>
          )}
        </div>
      ),
    },
    ...(isEntityTypes
      ? [{
          id: "category",
          header: m.category,
          responsive: "md" as const,
          cell: (it: IssueTypeOption) => (
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{getIssueTypeScopeLabel(messages, it)}</span>
          ),
        }]
      : []),
    { id: "fieldSchema", header: m.fieldSchema, responsive: "md", cell: (it) => <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{fieldSchemaName(it.fieldSchemaId)}</span> },
    { id: "statusSchema", header: m.statusSchema, responsive: "lg", cell: (it) => <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{statusSchemaName(it.statusSchemaId)}</span> },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.title }]}
      action={
        <Link href={isEntityTypes ? `${listPath}/new?category=${activeCategory}` : `${listPath}/new`}>
          <Button size="sm">{m.create}</Button>
        </Link>
      }
    >
      <div className="space-y-3">
        {isEntityTypes && (
          <div className="flex flex-wrap gap-2">
            {ENTITY_CATEGORY_TABS.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-[var(--radius-md)] border px-3 py-1.5 text-sm ${
                  activeCategory === category
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                }`}
              >
                {getEntityCategoryLabel(messages, category)}
              </button>
            ))}
          </div>
        )}
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(it) => it.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(it) => router.push(`${listPath}/${it.id}`)}
            getRowHref={(it) => `${listPath}/${it.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}

export default function IssueTypesPage() {
  return <IssueTypesAdminPage />;
}
