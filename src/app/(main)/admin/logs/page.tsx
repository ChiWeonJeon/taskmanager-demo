"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiLogEntry } from "@/lib/api-logger";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { useTableControls } from "@/lib/admin/use-table-controls";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";

export default function AdminLogsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { messages, locale } = useI18n();
  const m = messages.adminLogsPage;
  const { toast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: logs = [], isLoading } = useQuery<ApiLogEntry[]>({
    queryKey: ["admin", "logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
    refetchInterval: 10000,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/logs", { method: "DELETE" });
      if (!res.ok) throw new Error(m.clearFailed);
    },
    onSuccess: () => queryClient.setQueryData(["admin", "logs"], []),
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const { query, setQuery, sort, toggleSort, rows } = useTableControls(logs, {
    searchAccessor: (l) => `${l.method} ${l.route} ${l.message}`,
    sortAccessors: {
      time: (l) => l.timestamp,
      method: (l) => l.method,
      route: (l) => l.route,
    },
    initialSort: { columnId: "time", direction: "desc" },
  });

  const columns: DataTableColumn<ApiLogEntry>[] = [
    {
      id: "time",
      header: m.colTime,
      sortable: true,
      responsive: "sm",
      cell: (l) => <span className="whitespace-nowrap text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{new Date(l.timestamp).toLocaleString(locale)}</span>,
    },
    {
      id: "method",
      header: m.colMethod,
      sortable: true,
      cell: (l) => <Badge variant="warning">{l.method}</Badge>,
    },
    {
      id: "route",
      header: m.colRoute,
      sortable: true,
      responsive: "md",
      cell: (l) => <span className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-primary)]">{l.route}</span>,
    },
    {
      id: "message",
      header: m.colMessage,
      cell: (l) => <span className="block max-w-xs truncate text-[length:var(--text-xs)] text-[var(--color-danger)]">{l.message}</span>,
    },
  ];

  return (
    <AdminShell
      title={m.title}
      description={m.description}
      breadcrumbs={[{ href: "/admin", label: messages.admin.breadcrumbs.admin }, { label: m.title }]}
      action={
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmClear(true)}
          disabled={clearMutation.isPending || logs.length === 0}
        >
          {m.clearAll}
        </Button>
      }
    >
      <div className="space-y-3">
        <AdminListToolbar query={query} onQueryChange={setQuery} searchPlaceholder={m.searchPlaceholder} />
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(l) => l.id}
            isLoading={isLoading}
            sort={sort}
            onToggleSort={toggleSort}
            stickyHeader
            onRowClick={(l) => router.push(`/admin/logs/${l.id}`)}
            getRowHref={(l) => `/admin/logs/${l.id}`}
            emptyState={m.emptyTitle}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title={m.confirmClearTitle}
        confirmLabel={m.clearAll}
        cancelLabel={messages.adminCommon.cancel}
        variant="danger"
        busy={clearMutation.isPending}
        onConfirm={() => {
          setConfirmClear(false);
          clearMutation.mutate();
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </AdminShell>
  );
}
