"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

interface StatusRecord {
  id: string;
  name: string;
  key: string;
  color: string;
  category: StatusCategory;
  isSystem: boolean;
}

interface StatusFormState {
  name: string;
  key: string;
  color: string;
  category: StatusCategory;
}

const CATEGORY_OPTIONS: StatusCategory[] = ["TODO", "IN_PROGRESS", "DONE"];

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function emptyForm(): StatusFormState {
  return { name: "", key: "", color: "#6b7280", category: "TODO" };
}

function toForm(status: StatusRecord): StatusFormState {
  return {
    name: status.name,
    key: status.key,
    color: status.color || "#6b7280",
    category: status.category,
  };
}

interface StatusDetailProps {
  mode: "new" | "edit";
  statusId?: string;
}

export function StatusDetail({ mode, statusId }: StatusDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin.statuses;

  const categoryLabels: Record<StatusCategory, string> = {
    TODO: m.categoryTodo,
    IN_PROGRESS: m.categoryInProgress,
    DONE: m.categoryDone,
  };

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["statuses"],
    queryFn: async () => {
      const response = await fetch("/api/statuses");
      if (!response.ok) throw new Error(m.loadFailed);
      return response.json() as Promise<StatusRecord[]>;
    },
    enabled: mode === "edit",
  });

  const status = mode === "edit" ? statuses.find((s) => s.id === statusId) : undefined;
  const isSystem = Boolean(status?.isSystem);

  const form = useStagedForm<StatusFormState>(
    mode === "edit" && status ? toForm(status) : emptyForm(),
  );

  // Re-sync the baseline once the record loads in edit mode.
  const loadedKey = status
    ? `${status.id}:${status.key}:${status.name}:${status.color}:${status.category}`
    : "";
  useBaselineSync(form, status, loadedKey);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["statuses"] });

  const payload = (values: StatusFormState) => ({
    name: values.name.trim(),
    key: normalizeKey(values.key || values.name),
    color: values.color.trim() || "#6b7280",
    category: values.category,
  });

  const createMutation = useMutation({
    mutationFn: async (values: StatusFormState) => {
      const response = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(values)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.createFailed);
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.created, { type: "success" });
      router.push("/admin/statuses");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: StatusFormState) => {
      const response = await fetch(`/api/statuses/${statusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(values)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.updateFailed);
    },
    onSuccess: async (_data, values) => {
      await invalidate();
      form.reset(values); // re-sync baseline → clean state
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/statuses/${statusId}`, { method: "DELETE" });
      if (response.status === 204) return;
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.deleteFailed);
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.deleted, { type: "success" });
      router.push("/admin/statuses");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isValid = form.values.name.trim().length > 0;
  const readOnly = mode === "edit" && (isSystem || (!isLoading && !status));

  const breadcrumbs = [
    { label: messages.admin.breadcrumbs.admin, href: "/admin" },
    { label: m.title, href: "/admin/statuses" },
    { label: mode === "new" ? m.create : m.editTitle },
  ];

  return (
    <AdminDetailShell
      title={mode === "new" ? m.create : m.editTitle}
      breadcrumbs={breadcrumbs}
      isDirty={form.isDirty}
      isValid={isValid}
      isSaving={isSaving}
      onSave={() =>
        mode === "new"
          ? createMutation.mutate(form.values)
          : updateMutation.mutate(form.values)
      }
      onDiscard={() => form.reset()}
      onDelete={mode === "edit" && !isSystem && status ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={`${m.confirmDelete}?`}
      deleteConfirmDescription={messages.adminCommon.confirmDeleteBody}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={readOnly}
    >
      {mode === "edit" && !isLoading && !status ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : (
        <div className="space-y-4">
          {isSystem && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
              {m.systemHint}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={m.name}>
              <Input
                value={form.values.name}
                onChange={(e) => form.setField("name", e.target.value)}
                placeholder={m.namePlaceholder}
                disabled={readOnly}
              />
            </Field>
            <Field label={m.key}>
              <Input
                value={form.values.key}
                onChange={(e) => form.setField("key", e.target.value)}
                placeholder={m.keyPlaceholder}
                disabled={readOnly}
              />
            </Field>
            <Field label={m.color}>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.values.color || "#6b7280"}
                  onChange={(e) => form.setField("color", e.target.value)}
                  disabled={readOnly}
                  className="h-9 w-12 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1"
                />
                <Input
                  value={form.values.color}
                  onChange={(e) => form.setField("color", e.target.value)}
                  placeholder="#6b7280"
                  disabled={readOnly}
                />
              </div>
            </Field>
            <Field label={m.category}>
              <select
                value={form.values.category}
                onChange={(e) => form.setField("category", e.target.value as StatusCategory)}
                disabled={readOnly}
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:opacity-50"
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}
    </AdminDetailShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

// Keeps the staged baseline in sync with the loaded server record (edit mode):
// when the record first arrives (or changes identity), reset the form to it.
function useBaselineSync(
  form: ReturnType<typeof useStagedForm<StatusFormState>>,
  status: StatusRecord | undefined,
  loadedKey: string,
) {
  const ref = useRef("");
  useEffect(() => {
    if (status && ref.current !== loadedKey) {
      ref.current = loadedKey;
      form.reset(toForm(status));
    }
  }, [status, loadedKey, form]);
}
