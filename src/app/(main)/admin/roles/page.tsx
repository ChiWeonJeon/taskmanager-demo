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

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
  _count: { projectMembers: number };
}

export default function RolesPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin.roles;
  const pageMsg = messages.adminRolesPage;
  const permissionLabels = messages.permissions;

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error(pageMsg.loadFailed);
      return res.json() as Promise<Role[]>;
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(roles, {
    searchAccessor: (r) => `${r.name} ${r.description ?? ""}`,
    sortAccessors: {
      name: (r) => r.name,
      members: (r) => r._count.projectMembers,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<Role>[] = [
    {
      id: "name",
      header: m.name,
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-text-primary)]">{r.name}</span>
          {r.isSystem && <Badge variant="accent">{m.systemRole}</Badge>}
          {r.isDefault && <Badge variant="default">{m.defaultBadge}</Badge>}
        </div>
      ),
    },
    {
      id: "description",
      header: m.description_,
      responsive: "sm",
      cell: (r) => (
        <span className="text-[var(--color-text-secondary)]">{r.description}</span>
      ),
    },
    {
      id: "permissions",
      header: m.permissions,
      responsive: "md",
      cell: (r) => {
        const perms = JSON.parse(r.permissions) as string[];
        return (
          <div className="flex flex-wrap gap-1">
            {perms.map((perm) => (
              <Badge key={perm} variant="default">
                {permissionLabels[perm as keyof typeof permissionLabels] ?? perm}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "members",
      header: m.members,
      sortable: true,
      align: "right",
      cell: (r) => (
        <span className="text-[var(--color-text-secondary)]">{r._count.projectMembers}</span>
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
        <Link href="/admin/roles/new">
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
            rowKey={(r) => r.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(r) => router.push(`/admin/roles/${r.id}`)}
            getRowHref={(r) => `/admin/roles/${r.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}
