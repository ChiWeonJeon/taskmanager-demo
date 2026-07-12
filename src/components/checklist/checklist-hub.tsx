"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import {
  FeatureToolbar,
  featureToolbarLabelClass,
  featureToolbarPrimaryButtonClass,
} from "@/components/layout/feature-toolbar";
import { PlusIcon } from "@/components/task/task-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast";

interface Props {
  projectKey: string;
  canCreate: boolean;
  canEdit: boolean;
}

interface UserRef {
  id: string;
  name: string;
  email: string;
}

interface ChecklistRow {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  createdBy: UserRef;
  _count: { items: number; runs: number };
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    startedBy: UserRef;
  }>;
}

export function ChecklistHub({ projectKey, canCreate, canEdit }: Props) {
  const { messages } = useI18n();
  const t = messages.checklist;
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery<{ checklists: ChecklistRow[] }>({
    queryKey: ["checklists", projectKey],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectKey}/checklists`);
      if (!res.ok) throw new Error(t.hub.loadFailed);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: { title: string; description: string }) => {
      const res = await fetch(`/api/projects/${projectKey}/checklists`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t.create.createFailed);
      return res.json() as Promise<{ checklist: { id: string } }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["checklists", projectKey] });
      setShowCreate(false);
      toast(t.create.createSuccess, { type: "success" });
      // Land on the new master so the user can add items right away — items
      // are no longer captured during creation; they're managed in detail.
      router.push(`/projects/${projectKey}/checklists/${data.checklist.id}`);
    },
    onError: (error) => {
      toast(errorMessage(error, t.create.createFailed), { type: "error" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch(`/api/projects/${projectKey}/checklists/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(t.hub.reorderFailed);
      return res.json();
    },
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["checklists", projectKey] });
      const prev = qc.getQueryData<{ checklists: ChecklistRow[] }>(["checklists", projectKey]);
      if (prev) {
        const indexMap = new Map(ids.map((id, idx) => [id, idx]));
        const next = [...prev.checklists].sort(
          (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0),
        );
        qc.setQueryData(["checklists", projectKey], { checklists: next });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["checklists", projectKey], ctx.prev);
      toast(t.hub.reorderFailed, { type: "error" });
    },
    onSuccess: () => {
      toast(t.hub.reorderSuccess, { type: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["checklists", projectKey] });
    },
  });

  const columns: DataTableColumn<ChecklistRow>[] = [
    {
      id: "title",
      header: t.hub.colTitle,
      cell: (row) => (
        <div className="space-y-1">
          <div className="font-medium text-[var(--color-text-primary)]">{row.title}</div>
          {row.description && (
            <div className="line-clamp-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]">
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "items",
      header: t.hub.colItems,
      cell: (row) => (
        <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
          {row._count.items}
        </span>
      ),
      responsive: "sm",
      align: "right",
    },
    {
      id: "runs",
      header: t.hub.colRuns,
      cell: (row) => (
        <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
          {row._count.runs}
        </span>
      ),
      responsive: "md",
      align: "right",
    },
    {
      id: "status",
      header: t.hub.colStatus,
      cell: (row) =>
        row.runs[0] ? (
          <span className="inline-flex items-center rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[length:var(--text-3xs)] font-medium text-[var(--color-accent)]">
            {t.hub.runningBadge}
          </span>
        ) : (
          <span className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">—</span>
        ),
      responsive: "sm",
    },
    {
      id: "createdBy",
      header: t.hub.colCreatedBy,
      cell: (row) => (
        <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
          {row.createdBy.name}
        </span>
      ),
      responsive: "lg",
    },
    {
      id: "createdAt",
      header: t.hub.colCreatedAt,
      cell: (row) => (
        <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
          <DateDisplay date={row.createdAt} format="compact" />
        </span>
      ),
      responsive: "md",
    },
  ];

  return (
    <div className="space-y-3">
      {canCreate && (
        <FeatureToolbar>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={featureToolbarPrimaryButtonClass}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span className={featureToolbarLabelClass}>{t.hub.newButton}</span>
          </button>
        </FeatureToolbar>
      )}

      <DataTable<ChecklistRow>
        columns={columns}
        rows={query.data?.checklists ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        getRowHref={(row) => `/projects/${projectKey}/checklists/${row.id}`}
        onRowClick={(row) =>
          router.push(`/projects/${projectKey}/checklists/${row.id}`)
        }
        onReorder={canEdit ? (ids) => reorderMutation.mutate(ids) : undefined}
        reorderHandleLabel={t.hub.reorderHandle}
        emptyState={
          query.isError ? (
            <span className="text-[var(--color-danger)]">{t.hub.loadFailed}</span>
          ) : (
            t.hub.empty
          )
        }
      />

      {showCreate && (
        <CreateModal
          onCancel={() => setShowCreate(false)}
          onSubmit={(payload) => createMutation.mutate(payload)}
          submitting={createMutation.isPending}
          error={createMutation.isError ? t.create.createFailed : null}
        />
      )}
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface CreateModalProps {
  onCancel: () => void;
  onSubmit: (body: { title: string; description: string }) => void;
  submitting: boolean;
  error: string | null;
}

function CreateModal({ onCancel, onSubmit, submitting, error }: CreateModalProps) {
  const { messages } = useI18n();
  const t = messages.checklist.create;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = title.trim().length > 0;

  return (
    <Modal
      open
      onClose={onCancel}
      title={t.title}
      description={t.itemsHint}
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit || submitting}
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim(),
              })
            }
          >
            {submitting ? t.submitting : t.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="block text-[length:var(--text-2xs)] font-medium text-[var(--color-text-secondary)]">
            {t.titleLabel}
          </span>
          <Input
            className="mt-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
          />
        </label>
        <label className="block">
          <span className="block text-[length:var(--text-2xs)] font-medium text-[var(--color-text-secondary)]">
            {t.descriptionLabel}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descriptionPlaceholder}
            rows={2}
            className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-[length:var(--text-sm)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
          />
        </label>
        {error && (
          <div className="text-[length:var(--text-xs)] text-[var(--color-danger)]">{error}</div>
        )}
      </div>
    </Modal>
  );
}
