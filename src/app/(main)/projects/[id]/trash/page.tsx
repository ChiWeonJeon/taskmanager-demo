"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateDisplay } from "@/components/shared/date-display";
import { fetchJsonWithTimeout } from "@/lib/fetch-json-with-timeout";
import { useI18n } from "@/components/shared/locale-provider";

interface TrashedItem {
  id: string;
  issueKey: string;
  title: string;
  deletedAt: string;
  status: { id: string; name: string; color: string; category: string };
  issueType: { id: string; name: string; color: string | null };
  assignee: { id: string; name: string; email: string } | null;
}

export default function ProjectTrashPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectKey } = use(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.projectTrashPage;

  const trashQuery = useQuery<TrashedItem[]>({
    queryKey: ["trash", projectKey],
    queryFn: () => fetchJsonWithTimeout<TrashedItem[]>(`/api/trash?projectKey=${projectKey}`),
    retry: 1,
  });
  const items = trashQuery.data ?? [];
  const isLoading = trashQuery.isLoading || (trashQuery.isFetching && !trashQuery.data);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/work-items/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore work item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash", projectKey] });
      queryClient.invalidateQueries({ queryKey: ["work-items", "project", projectKey] });
      toast(m.restoreSuccess, { type: "success" });
    },
    onError: () => toast(m.restoreFailed, { type: "error", sticky: true }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{m.title}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          {m.description}
        </p>
      </div>

      {trashQuery.isError && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {m.loadFailed}
          <button
            type="button"
            className="ml-3 rounded border border-[var(--color-danger)] bg-white px-2 py-1 text-xs font-medium hover:bg-[var(--color-danger-light)]"
            onClick={() => trashQuery.refetch()}
          >
            {messages.common.retry}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-tertiary)]">
          <p className="text-lg">{m.emptyTitle}</p>
          <p className="text-sm mt-1">{m.emptyDescription}</p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <Badge color={item.status.color}>{item.status.name}</Badge>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)] shrink-0 min-w-12">
                {item.issueKey}
              </span>
              <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                {item.title}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:block shrink-0">
                {item.assignee?.name ?? messages.commonUi.unassigned}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:flex items-center gap-1 shrink-0">
                {m.deletedLabel} <DateDisplay date={item.deletedAt} format="short" />
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => restoreMutation.mutate(item.id)}
                disabled={restoreMutation.isPending}
                className="shrink-0 text-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {m.restore}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
