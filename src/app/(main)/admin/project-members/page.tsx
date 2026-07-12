"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { DateDisplay } from "@/components/shared/date-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleId: string;
  source?: string;
  groupName?: string | null;
  createdAt: string;
  isOwner?: boolean;
  user: { id: string; name: string; email: string };
  role: { id: string; name: string };
  project: { id: string; name: string; key: string };
}

export default function ProjectMembersPage() {
  const router = useRouter();
  const { messages } = useI18n();
  const m = messages.admin.projectMembers;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-project-members"],
    queryFn: async () => {
      const r = await fetch("/api/admin/project-members");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json() as Promise<ProjectMember[]>;
    },
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(members, {
    searchAccessor: (mem) => `${mem.project.key} ${mem.project.name} ${mem.user.name} ${mem.user.email} ${mem.role.name}`,
    sortAccessors: {
      project: (mem) => mem.project.name,
      user: (mem) => mem.user.name,
      joinedAt: (mem) => mem.createdAt,
    },
    initialSort: { columnId: "project", direction: "asc" },
  });

  const columns: DataTableColumn<ProjectMember>[] = [
    {
      id: "project",
      header: m.project,
      sortable: true,
      cell: (mem) => (
        <span className="text-[var(--color-text-primary)]">
          <span className="font-medium">[{mem.project.key}]</span> {mem.project.name}
        </span>
      ),
    },
    {
      id: "user",
      header: m.user,
      sortable: true,
      cell: (mem) => (
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">{mem.user.name}</div>
          <div className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">{mem.user.email}</div>
        </div>
      ),
    },
    {
      id: "role",
      header: m.role,
      responsive: "sm",
      cell: (mem) => (
        <div className="flex items-center gap-1.5">
          {mem.isOwner ? <Badge variant="accent">{m.owner}</Badge> : <Badge variant="default">{mem.role.name}</Badge>}
          {!mem.isOwner && mem.source === "group" && (
            <Badge variant="default" title={mem.groupName ?? undefined}>{m.inheritedBadge}</Badge>
          )}
        </div>
      ),
    },
    { id: "joinedAt", header: m.joinedAt, sortable: true, responsive: "md", cell: (mem) => <DateDisplay date={mem.createdAt} format="compact" /> },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ label: messages.admin.breadcrumbs.admin, href: "/admin" }, { label: m.title }]}
      action={
        <Link href="/admin/project-members/new">
          <Button size="sm">{m.add}</Button>
        </Link>
      }
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(mem) => mem.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(mem) => router.push(`/admin/project-members/${mem.id}`)}
            getRowHref={(mem) => `/admin/project-members/${mem.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>
    </AdminShell>
  );
}
