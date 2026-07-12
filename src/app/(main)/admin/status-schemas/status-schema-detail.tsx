"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useToast } from "@/lib/toast";
import { useI18n } from "@/components/shared/locale-provider";
import { useStagedForm } from "@/lib/admin/use-staged-form";

interface StatusRecord {
  id: string;
  name: string;
  key?: string;
  color: string;
  category: string;
  isSystem?: boolean;
}
interface StatusTransitionRecord {
  fromStatusId: string;
  toStatusId: string;
}
interface StatusSchemaRecord {
  id: string;
  name: string;
  startStatusId?: string | null;
  startStatus?: StatusRecord | null;
  statuses: { statusId?: string; sortOrder: number; status: StatusRecord }[];
  transitions?: StatusTransitionRecord[];
  issueTypes: { id: string; name: string }[];
}
interface FormState {
  name: string;
  statusIds: string[];
  startStatusId: string;
  transitions: StatusTransitionRecord[];
}

const EMPTY: FormState = { name: "", statusIds: [], startStatusId: "", transitions: [] };

function hasTransition(t: StatusTransitionRecord[], from: string, to: string) {
  return t.some((x) => x.fromStatusId === from && x.toStatusId === to);
}
function toggleTransition(t: StatusTransitionRecord[], from: string, to: string) {
  return hasTransition(t, from, to)
    ? t.filter((x) => !(x.fromStatusId === from && x.toStatusId === to))
    : [...t, { fromStatusId: from, toStatusId: to }];
}
function moveItem<T>(items: T[], fromIndex: number, direction: -1 | 1) {
  const next = fromIndex + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(next, 0, item);
  return copy;
}

interface StatusSchemaDetailProps {
  mode: "new" | "edit";
  schemaId?: string;
}

export function StatusSchemaDetail({ mode, schemaId }: StatusSchemaDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin.statusSchemas;

  const { data: statuses = [] } = useQuery({
    queryKey: ["statuses"],
    queryFn: async () => {
      const r = await fetch("/api/statuses");
      if (!r.ok) throw new Error(messages.admin.statuses.loadFailed);
      return r.json() as Promise<StatusRecord[]>;
    },
  });
  const { data: schemas = [], isLoading } = useQuery({
    queryKey: ["status-schemas"],
    queryFn: async () => {
      const r = await fetch("/api/status-schemas");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json() as Promise<StatusSchemaRecord[]>;
    },
    enabled: mode === "edit",
  });

  const schema = mode === "edit" ? schemas.find((s) => s.id === schemaId) : undefined;
  const form = useStagedForm<FormState>(EMPTY);
  const statusMap = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const syncedRef = useRef("");
  useEffect(() => {
    if (mode !== "edit") {
      if (syncedRef.current !== "new") {
        syncedRef.current = "new";
        form.reset(EMPTY);
      }
      return;
    }
    if (!schema) return;
    const key = `edit:${schema.id}`;
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    form.reset({
      name: schema.name,
      statusIds: schema.statuses.map((e) => e.statusId ?? e.status.id),
      startStatusId: schema.startStatusId ?? schema.startStatus?.id ?? schema.statuses[0]?.status.id ?? "",
      transitions: schema.transitions ?? [],
    });
  }, [mode, schema, form]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["status-schemas"] }),
      queryClient.invalidateQueries({ queryKey: ["issue-types"] }),
    ]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const r = await fetch(mode === "new" ? "/api/status-schemas" : `/api/status-schemas/${schemaId}`, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          statusIds: values.statusIds,
          startStatusId: values.startStatusId || values.statusIds[0],
          transitions: values.transitions,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || (mode === "new" ? m.createFailed : m.updateFailed));
    },
    onSuccess: async (_d, values) => {
      await invalidate();
      if (mode === "new") {
        toast(m.created, { type: "success" });
        router.push("/admin/status-schemas");
      } else {
        form.reset(values);
        toast(m.updated, { type: "success" });
      }
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/status-schemas/${schemaId}`, { method: "DELETE" });
      if (r.status === 204) return;
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || m.deleteFailed);
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.deleted, { type: "success" });
      router.push("/admin/status-schemas");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const v = form.values;
  const selectedSet = new Set(v.statusIds);
  const availableStatuses = statuses.filter((s) => !selectedSet.has(s.id));
  const isValid = v.name.trim().length > 0 && v.statusIds.length > 0;
  const notFound = mode === "edit" && !isLoading && !schema;
  const canDelete = mode === "edit" && schema && schema.issueTypes.length === 0;
  const radioName = `start-status-${schemaId ?? "create"}`;

  return (
    <AdminDetailShell
      title={mode === "new" ? m.create : m.editTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: "/admin/status-schemas" },
        { label: mode === "new" ? m.create : m.editTitle },
      ]}
      isDirty={form.isDirty}
      isValid={isValid}
      isSaving={saveMutation.isPending}
      onSave={() => saveMutation.mutate(v)}
      onDiscard={() => form.reset()}
      onDelete={canDelete ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={m.confirmDelete}
      deleteConfirmDescription={m.dangerZoneDescription}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={notFound}
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.schemaName}</span>
            <Input value={v.name} onChange={(e) => form.setField("name", e.target.value)} placeholder={m.namePlaceholder} />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.orderedStatuses}</h3>
                <span className="text-xs text-[var(--color-text-secondary)]">{m.statusCount.replace("{count}", String(v.statusIds.length))}</span>
              </div>
              {v.statusIds.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">{m.noStatuses}</div>
              ) : (
                <div className="space-y-2">
                  {v.statusIds.map((statusId, index) => {
                    const status = statusMap.get(statusId);
                    if (!status) return null;
                    const isStart = (v.startStatusId || v.statusIds[0]) === status.id;
                    return (
                      <div key={status.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                              <span className="text-sm font-medium text-[var(--color-text-primary)]">{status.name}</span>
                              <Badge>{status.category}</Badge>
                              {status.isSystem && <Badge variant="accent">{messages.admin.statuses.system}</Badge>}
                              {isStart && <Badge variant="accent">{m.startStatus}</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{status.key ?? status.id}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                              <input type="radio" name={radioName} checked={isStart} onChange={() => form.setField("startStatusId", status.id)} />
                              {m.startStatus}
                            </label>
                            <Button type="button" size="sm" variant="ghost" onClick={() => form.setValues((c) => ({ ...c, statusIds: moveItem(c.statusIds, index, -1) }))} disabled={index === 0}>
                              {m.up}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => form.setValues((c) => ({ ...c, statusIds: moveItem(c.statusIds, index, 1) }))} disabled={index === v.statusIds.length - 1}>
                              {m.down}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                form.setValues((c) => {
                                  const nextStatusIds = c.statusIds.filter((id) => id !== status.id);
                                  return {
                                    ...c,
                                    statusIds: nextStatusIds,
                                    startStatusId: c.startStatusId === status.id ? nextStatusIds[0] ?? "" : c.startStatusId,
                                    transitions: c.transitions.filter((t) => t.fromStatusId !== status.id && t.toStatusId !== status.id),
                                  };
                                })
                              }
                            >
                              {m.remove}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.availableStatuses}</h3>
                <span className="text-xs text-[var(--color-text-secondary)]">{m.remainingCount.replace("{count}", String(availableStatuses.length))}</span>
              </div>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] p-2">
                {availableStatuses.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-[var(--color-text-secondary)]">{m.allIncluded}</div>
                ) : (
                  availableStatuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => form.setValues((c) => ({ ...c, statusIds: [...c.statusIds, status.id], startStatusId: c.startStatusId || status.id }))}
                      className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                          <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{status.name}</span>
                        </div>
                        <p className="truncate text-xs text-[var(--color-text-secondary)]">{status.key ?? status.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{status.category}</Badge>
                        {status.isSystem && <Badge variant="accent">{messages.admin.statuses.system}</Badge>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {v.statusIds.length >= 2 && (
            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.transitions}</h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{v.transitions.length === 0 ? m.transitionsEmptyHint : m.transitionsHint}</p>
              </div>
              <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">{m.transitionFromTo}</th>
                      {v.statusIds.map((toId) => {
                        const s = statusMap.get(toId);
                        if (!s) return null;
                        return <th key={toId} className="px-3 py-2 text-center font-medium">{s.name}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {v.statusIds.map((fromId) => {
                      const fromStatus = statusMap.get(fromId);
                      if (!fromStatus) return null;
                      return (
                        <tr key={fromId} className="border-t border-[var(--color-border)]">
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-[var(--color-text-primary)]">{fromStatus.name}</td>
                          {v.statusIds.map((toId) => (
                            <td key={toId} className="px-3 py-2 text-center">
                              {fromId === toId ? (
                                <span className="text-[var(--color-text-tertiary)]">—</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  aria-label={`${fromStatus.name} → ${statusMap.get(toId)?.name ?? toId}`}
                                  checked={hasTransition(v.transitions, fromId, toId)}
                                  onChange={() => form.setValues((c) => ({ ...c, transitions: toggleTransition(c.transitions, fromId, toId) }))}
                                />
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminDetailShell>
  );
}
