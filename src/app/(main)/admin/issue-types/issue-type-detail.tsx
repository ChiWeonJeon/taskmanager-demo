"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FieldSchemaOption,
  IssueTypeOption,
  ProjectOption,
  StatusSchemaOption,
} from "@/components/task/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";
import { resolveSchemaFieldRequired } from "@/lib/field-schema";
import { getIssueTypeScopeLabel } from "@/components/task/issue-type-label";

interface AdminProjectOption extends ProjectOption {
  description?: string | null;
  workItemCount?: number;
}

interface IssueTypeFormState {
  key: string;
  name: string;
  category: "ISSUE" | "CYCLE";
  color: string;
  icon: string;
  fieldSchemaId: string;
  statusSchemaId: string;
  projectIds: string[];
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
function resolveColorValue(value: string) {
  return isHexColor(value) ? value : "#4f7ee8";
}
function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const EMPTY: IssueTypeFormState = { key: "", name: "", category: "ISSUE", color: "", icon: "", fieldSchemaId: "", statusSchemaId: "", projectIds: [] };

function normalizeCategory(value: unknown): IssueTypeFormState["category"] {
  return value === "CYCLE" ? value : "ISSUE";
}

function defaultFieldSchemaIdForCategory(category: IssueTypeFormState["category"], fieldSchemas: FieldSchemaOption[]) {
  const preferredId = category === "CYCLE"
      ? "system-cycle-field-schema"
      : "system-canonical-field-schema";

  return fieldSchemas.find((schema) => schema.id === preferredId)?.id ?? fieldSchemas[0]?.id ?? "";
}

function defaultStatusSchemaIdForCategory(category: IssueTypeFormState["category"], statusSchemas: StatusSchemaOption[], requireStatusSchema: boolean) {
  const preferredId = category === "CYCLE" ? "system-cycle-status-schema" : "system-default-status-schema";
  return statusSchemas.find((schema) => schema.id === preferredId)?.id ?? (requireStatusSchema ? statusSchemas[0]?.id ?? "" : "");
}

function categoryHasRecords(issueType: IssueTypeOption | undefined) {
  const counts = issueType?._count;
  return Boolean((counts?.workItems ?? 0) > 0 || (counts?.cycles ?? 0) > 0);
}

interface IssueTypeDetailProps {
  mode: "new" | "edit";
  issueTypeId?: string;
  apiBase?: string;
  listPath?: string;
  queryKey?: string[];
  messagesKind?: "issueTypes" | "entityTypes";
  requireStatusSchema?: boolean;
}

export function IssueTypeDetail({
  mode,
  issueTypeId,
  apiBase = "/api/issue-types",
  listPath = "/admin/issue-types",
  queryKey = ["issue-types"],
  messagesKind = "issueTypes",
  requireStatusSchema = true,
}: IssueTypeDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin[messagesKind];

  const reqFailed = m.requestFailed;
  const { data: issueTypes = [], isLoading } = useQuery<IssueTypeOption[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(apiBase);
      if (!r.ok) throw new Error(reqFailed);
      return r.json();
    },
    enabled: mode === "edit",
  });
  const { data: fieldSchemas = [] } = useQuery<FieldSchemaOption[]>({
    queryKey: ["field-schemas"],
    queryFn: async () => {
      const r = await fetch("/api/field-schemas");
      if (!r.ok) throw new Error(reqFailed);
      return r.json();
    },
  });
  const { data: statusSchemas = [] } = useQuery<StatusSchemaOption[]>({
    queryKey: ["status-schemas"],
    queryFn: async () => {
      const r = await fetch("/api/status-schemas");
      if (!r.ok) throw new Error(reqFailed);
      return r.json();
    },
  });
  const { data: projects = [] } = useQuery<AdminProjectOption[]>({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const r = await fetch("/api/admin/projects");
      if (!r.ok) throw new Error(reqFailed);
      return r.json();
    },
  });

  const issueType = mode === "edit" ? issueTypes.find((it) => it.id === issueTypeId) : undefined;
  const initialCategory = normalizeCategory(searchParams.get("category"));
  const form = useStagedForm<IssueTypeFormState>(EMPTY);

  // Sync baseline once data loads: edit → record values; new → schema defaults.
  const syncedRef = useRef("");
  useEffect(() => {
    if (fieldSchemas.length === 0) return;
    if (mode === "edit") {
      if (!issueType) return;
      const key = `edit:${issueType.id}`;
      if (syncedRef.current === key) return;
      syncedRef.current = key;
      form.reset({
        key: issueType.key ?? "",
        name: issueType.name,
        category: normalizeCategory(issueType.category),
        color: issueType.color ?? "",
        icon: issueType.icon ?? "",
        fieldSchemaId: issueType.fieldSchemaId,
        statusSchemaId: issueType.statusSchemaId ?? "",
        projectIds: issueType.projectLinks?.map((l) => l.projectId) ?? [],
      });
    } else {
      const defaultFieldSchemaId = defaultFieldSchemaIdForCategory(initialCategory, fieldSchemas);
      const defaultStatusSchemaId = defaultStatusSchemaIdForCategory(initialCategory, statusSchemas, requireStatusSchema);
      const key = `new:${initialCategory}:${defaultFieldSchemaId}:${defaultStatusSchemaId}`;
      if (syncedRef.current === key) return;
      syncedRef.current = key;
      form.reset({
        ...EMPTY,
        category: initialCategory,
        fieldSchemaId: defaultFieldSchemaId,
        statusSchemaId: defaultStatusSchemaId,
      });
    }
  }, [mode, issueType, fieldSchemas, statusSchemas, form, requireStatusSchema, initialCategory]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["field-schemas"] }),
      queryClient.invalidateQueries({ queryKey: ["status-schemas"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["my-projects"] }),
    ]);

  const save = async (values: IssueTypeFormState) => {
    const r = await fetch(mode === "new" ? apiBase : `${apiBase}/${issueTypeId}`, {
      method: mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(messagesKind === "entityTypes" ? { key: normalizeKey(values.key || values.name) } : {}),
        name: values.name.trim(),
        ...(messagesKind === "entityTypes" ? { category: values.category } : {}),
        color: values.color.trim() || null,
        icon: values.icon.trim() || null,
        fieldSchemaId: values.fieldSchemaId,
        statusSchemaId: values.statusSchemaId || null,
        projectIds: values.projectIds,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || reqFailed);
    }
    return r.json();
  };

  const saveMutation = useMutation({
    mutationFn: save,
    onSuccess: async (_d, values) => {
      await invalidate();
      if (mode === "new") {
        toast(m.created, { type: "success" });
        router.push(listPath);
      } else {
        form.reset(values);
        toast(m.updated, { type: "success" });
      }
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${apiBase}/${issueTypeId}`, { method: "DELETE" });
      if (r.status === 204) return;
      const e = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(e.error || m.deleteFailed);
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.deleted, { type: "success" });
      router.push(listPath);
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const v = form.values;
  const selectedFieldSchema = fieldSchemas.find((s) => s.id === v.fieldSchemaId) ?? null;
  const selectedStatusSchema = statusSchemas.find((s) => s.id === v.statusSchemaId) ?? null;
  const selectedProjects = projects.filter((p) => v.projectIds.includes(p.id));
  const isCategoryLocked = messagesKind === "entityTypes" && mode === "edit" && categoryHasRecords(issueType);
  const entityScopeLabel = getIssueTypeScopeLabel(messages, { key: normalizeKey(v.key || v.name), name: v.name, category: v.category });
  const isValid = Boolean(v.name.trim() && (messagesKind !== "entityTypes" || (normalizeKey(v.key || v.name) && v.category)) && v.fieldSchemaId && (requireStatusSchema ? v.statusSchemaId : true));
  const notFound = mode === "edit" && !isLoading && !issueType;

  const projectLabel = (p: AdminProjectOption) => (p.isPersonal ? `${p.name} ${m.personalSuffix}` : `${p.key} - ${p.name}`);

  return (
    <AdminDetailShell
      title={mode === "new" ? m.create : m.editTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.title, href: listPath },
        { label: mode === "new" ? m.create : m.editTitle },
      ]}
      isDirty={form.isDirty}
      isValid={isValid}
      isSaving={saveMutation.isPending}
      onSave={() => saveMutation.mutate(v)}
      onDiscard={() => form.reset()}
      onDelete={mode === "edit" && issueType ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={m.confirmDelete}
      deleteConfirmDescription={m.dangerZoneDescription}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={notFound}
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Labeled label={m.name}>
              <Input value={v.name} onChange={(e) => form.setField("name", e.target.value)} placeholder={m.namePlaceholder} />
            </Labeled>
            {messagesKind === "entityTypes" && (
              <Labeled label={m.key}>
                <Input
                  value={v.key}
                  onChange={(e) => form.setField("key", normalizeKey(e.target.value))}
                  placeholder={m.keyPlaceholder}
                  disabled={mode === "edit"}
                />
              </Labeled>
            )}
            {messagesKind === "entityTypes" && (
              <Labeled label={m.category}>
                <select
                  value={v.category}
                  onChange={(e) => form.setField("category", normalizeCategory(e.target.value))}
                  disabled={isCategoryLocked}
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:bg-[var(--color-bg-secondary)] disabled:text-[var(--color-text-tertiary)]"
                >
                  <option value="ISSUE">{messages.entityTypeScopes.issue}</option>
                  <option value="CYCLE">{messages.entityTypeScopes.cycle}</option>
                </select>
                {isCategoryLocked && (
                  <span className="mt-1 block text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">{m.categoryLockedHint}</span>
                )}
              </Labeled>
            )}
            <Labeled label={m.icon}>
              <Input value={v.icon} onChange={(e) => form.setField("icon", e.target.value)} placeholder={m.iconPlaceholder} />
            </Labeled>
            <Labeled label={m.color}>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={resolveColorValue(v.color)}
                  onChange={(e) => form.setField("color", e.target.value)}
                  className="h-9 w-12 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1"
                />
                <Input value={v.color} onChange={(e) => form.setField("color", e.target.value)} placeholder={m.colorPlaceholder} />
              </div>
            </Labeled>
            <Labeled label={m.fieldSchema}>
              <SchemaSelect value={v.fieldSchemaId} onChange={(val) => form.setField("fieldSchemaId", val)} options={fieldSchemas} />
            </Labeled>
            {messagesKind === "entityTypes" && (
              <div>
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{m.scope}</span>
                <div className="flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 text-sm text-[var(--color-text-primary)]">
                  {entityScopeLabel}
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <Labeled label={m.statusSchema}>
                <SchemaSelect
                  value={v.statusSchemaId}
                  onChange={(val) => form.setField("statusSchemaId", val)}
                  options={statusSchemas}
                  optionalLabel={requireStatusSchema ? undefined : m.noStatusSchema}
                />
              </Labeled>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{m.appliedProjects}</p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] p-2">
              {projects.map((project) => (
                <label key={project.id} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={v.projectIds.includes(project.id)}
                    onChange={() =>
                      form.setValues((c) => ({
                        ...c,
                        projectIds: c.projectIds.includes(project.id)
                          ? c.projectIds.filter((id) => id !== project.id)
                          : [...c.projectIds, project.id],
                      }))
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-text-primary)]">{projectLabel(project)}</span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">{project.workItemCount ?? 0} {m.workItems}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Preview
              title={`${m.fieldSchema}: ${selectedFieldSchema?.name ?? m.unknownSchema}`}
              items={selectedFieldSchema?.fields.map((e) => (resolveSchemaFieldRequired(e.field.key, e.isRequired, e.field.isRequired) ? `${e.field.name} ${m.requiredSuffix}` : e.field.name)) ?? []}
              noMapped={m.noMapped}
            />
            <Preview
              title={`${m.statusSchema}: ${selectedStatusSchema?.name ?? m.unknownSchema}`}
              items={selectedStatusSchema?.statuses.map((e) => (selectedStatusSchema.startStatusId === (e.statusId ?? e.status.id) ? `${e.status.name} ${m.startSuffix}` : e.status.name)) ?? []}
              noMapped={m.noMapped}
            />
            <Preview title={m.appliedProjects} items={selectedProjects.map(projectLabel)} noMapped={m.noMapped} />
          </div>

          {selectedProjects.length > 0 && (
            <div>
              <Badge variant="accent">{selectedProjects.length} {m.projects}</Badge>
            </div>
          )}
        </div>
      )}
    </AdminDetailShell>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function SchemaSelect({
  value,
  onChange,
  options,
  optionalLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  optionalLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
    >
      {optionalLabel ? <option value="">{optionalLabel}</option> : null}
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function Preview({ title, items, noMapped }: { title: string; items: string[]; noMapped: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
      <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{title}</p>
      <p className="mt-1 text-[length:var(--text-xs)] leading-relaxed text-[var(--color-text-primary)]">{items.length > 0 ? items.join(", ") : noMapped}</p>
    </div>
  );
}
