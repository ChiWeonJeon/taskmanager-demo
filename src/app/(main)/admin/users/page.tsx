"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { DateDisplay } from "@/components/shared/date-display";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin.users;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json() as Promise<User[]>;
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(users, {
    searchAccessor: (u) => `${u.name} ${u.email}`,
    sortAccessors: {
      name: (u) => u.name,
      email: (u) => u.email,
      role: (u) => u.role,
      createdAt: (u) => u.createdAt,
    },
    initialSort: { columnId: "name", direction: "asc" },
  });

  const columns: DataTableColumn<User>[] = [
    { id: "name", header: m.name, sortable: true, cell: (u) => <span className="font-medium text-[var(--color-text-primary)]">{u.name}</span> },
    { id: "email", header: m.email, sortable: true, responsive: "sm", cell: (u) => <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{u.email}</span> },
    {
      id: "role",
      header: m.role,
      sortable: true,
      cell: (u) => <Badge variant={u.role === "ADMIN" ? "accent" : "default"}>{u.role === "ADMIN" ? m.roleAdmin : m.roleUser}</Badge>,
    },
    { id: "createdAt", header: m.createdAt, sortable: true, responsive: "md", cell: (u) => <DateDisplay date={u.createdAt} format="compact" /> },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.title }]}
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(u) => u.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
            getRowHref={(u) => `/admin/users/${u.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}
