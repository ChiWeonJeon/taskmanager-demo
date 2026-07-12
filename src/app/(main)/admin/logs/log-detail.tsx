"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiLogEntry } from "@/lib/api-logger";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/shared/locale-provider";

// API error logs are in-memory and ephemeral. The detail is a readOnly
// AdminDetailShell (no save bar) that reads the entry from the list cache
// (["admin","logs"]) by id; if the log was cleared/rotated, it shows notFound.
export function LogDetail({ logId }: { logId: string }) {
  const { messages, locale } = useI18n();
  const m = messages.adminLogsPage;

  const { data: logs = [], isLoading } = useQuery<ApiLogEntry[]>({
    queryKey: ["admin", "logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs");
      if (!res.ok) throw new Error(m.loadFailed);
      return res.json();
    },
  });

  const log = logs.find((l) => l.id === logId);
  const notFound = !isLoading && !log;

  return (
    <AdminDetailShell
      title={m.detailTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: "/admin/logs" },
        { label: m.detailTitle },
      ]}
      isDirty={false}
      isValid
      isSaving={false}
      onSave={() => {}}
      onDiscard={() => {}}
      readOnly
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : log ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">{log.method}</Badge>
            <span className="font-mono text-[length:var(--text-xs)] text-[var(--color-text-primary)]">{log.route}</span>
          </div>
          <LogBlock label={m.detailTimestamp}>
            {new Date(log.timestamp).toLocaleString(locale)}
          </LogBlock>
          <LogBlock label={m.detailMessage} tone="danger">
            {log.message}
          </LogBlock>
          {log.context && (
            <LogBlock label={m.detailContext}>
              {(() => { try { return JSON.stringify(JSON.parse(log.context!), null, 2); } catch { return log.context; } })()}
            </LogBlock>
          )}
          {log.stack && (
            <LogBlock label={m.detailStack} muted>
              {log.stack}
            </LogBlock>
          )}
        </div>
      ) : null}
    </AdminDetailShell>
  );
}

function LogBlock({
  label,
  children,
  tone,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "danger";
  muted?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <pre
        className={`overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--radius-md)] p-2 text-xs font-mono ${
          tone === "danger"
            ? "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
            : muted
              ? "max-h-64 overflow-y-auto bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
        }`}
      >
        {children}
      </pre>
    </div>
  );
}
