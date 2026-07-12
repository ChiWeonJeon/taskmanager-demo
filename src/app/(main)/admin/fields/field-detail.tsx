"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

type FieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "SELECT"
  | "MULTI_SELECT"
  | "OBJECT_REF"
  | "MULTI_OBJECT_REF"
  | "ENTITY_REF"
  | "MULTI_ENTITY_REF"
  | "REFERENCE"
  | "MULTI_REFERENCE"
  | "USER"
  | "URL";

interface FieldRecord {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  referenceObjectKey: string | null;
  options: string | null;
  defaultValue: string | null;
  isSystem: boolean;
}
interface ReferenceObjectRecord {
  key: string;
  name: string;
}
interface EntityTypeRecord {
  key: string | null;
  name: string;
}
interface FieldOption {
  value: string;
  label: string;
  color?: string | null;
}
interface FormState {
  name: string;
  key: string;
  type: FieldType;
  referenceObjectKey: string;
  options: FieldOption[];
  defaultSelectValue: string;
  defaultMultiValues: string[];
}

const FIELD_TYPE_OPTIONS: FieldType[] = [
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "OBJECT_REF",
  "MULTI_OBJECT_REF",
  "ENTITY_REF",
  "MULTI_ENTITY_REF",
  "USER",
  "URL",
];
const emptyOption = (): FieldOption => ({ value: "", label: "", color: "" });
const EMPTY: FormState = { name: "", key: "", type: "TEXT", referenceObjectKey: "", options: [emptyOption()], defaultSelectValue: "", defaultMultiValues: [] };

function parseOptions(raw: string | null): FieldOption[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (o): o is FieldOption =>
            typeof o === "object" && o !== null && typeof (o as FieldOption).value === "string" && typeof (o as FieldOption).label === "string",
        )
      : [];
  } catch {
    return [];
  }
}
function parseDefault(field: FieldRecord): unknown {
  if (!field.defaultValue) return null;
  try {
    return JSON.parse(field.defaultValue);
  } catch {
    return field.defaultValue;
  }
}
function toForm(field: FieldRecord): FormState {
  const options = parseOptions(field.options);
  const def = parseDefault(field);
  return {
    name: field.name,
    key: field.key,
    type: field.type,
    referenceObjectKey: field.referenceObjectKey ?? "",
    options: options.length > 0 ? options : [emptyOption()],
    defaultSelectValue: typeof def === "string" ? def : "",
    defaultMultiValues: Array.isArray(def) ? def.filter((v): v is string => typeof v === "string") : [],
  };
}
function buildPayload(form: FormState) {
  const optionBased = form.type === "SELECT" || form.type === "MULTI_SELECT";
  const referenceBased = isReferenceTargetField(form.type);
  const options = optionBased
    ? form.options.map((o) => ({ value: o.value.trim(), label: o.label.trim(), color: o.color?.trim() || null })).filter((o) => o.value && o.label)
    : undefined;
  return {
    name: form.name.trim(),
    key: form.key.trim(),
    type: form.type,
    referenceObjectKey: referenceBased && form.type !== "USER" ? form.referenceObjectKey : null,
    options,
    defaultValue: optionBased ? (form.type === "SELECT" ? form.defaultSelectValue || null : form.defaultMultiValues) : null,
  };
}

function isObjectReferenceType(type: FieldType) {
  return type === "OBJECT_REF" || type === "MULTI_OBJECT_REF" || type === "REFERENCE" || type === "MULTI_REFERENCE";
}

function isEntityReferenceType(type: FieldType) {
  return type === "ENTITY_REF" || type === "MULTI_ENTITY_REF";
}

function isReferenceTargetField(type: FieldType) {
  return isObjectReferenceType(type) || isEntityReferenceType(type) || type === "USER";
}

interface FieldDetailProps {
  mode: "new" | "edit";
  fieldId?: string;
}

export function FieldDetail({ mode, fieldId }: FieldDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.adminFieldsPage;

  const { data: referenceObjects = [] } = useQuery<ReferenceObjectRecord[]>({
    queryKey: ["reference-objects"],
    queryFn: async () => {
      const r = await fetch("/api/reference-objects");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
  });
  const { data: entityTypes = [] } = useQuery<EntityTypeRecord[]>({
    queryKey: ["entity-types", "summary"],
    queryFn: async () => {
      const r = await fetch("/api/entity-types?view=summary");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
  });

  const { data: fields = [], isLoading } = useQuery<FieldRecord[]>({
    queryKey: ["fields"],
    queryFn: async () => {
      const r = await fetch("/api/fields");
      if (!r.ok) throw new Error(m.loadFailed);
      return r.json();
    },
    enabled: mode === "edit",
  });

  const field = mode === "edit" ? fields.find((f) => f.id === fieldId) : undefined;
  const form = useStagedForm<FormState>(EMPTY);

  const syncedRef = useRef("");
  useEffect(() => {
    if (mode !== "edit") {
      if (syncedRef.current !== "new") {
        syncedRef.current = "new";
        form.reset(EMPTY);
      }
      return;
    }
    if (!field) return;
    if (syncedRef.current === field.id) return;
    syncedRef.current = field.id;
    form.reset(toForm(field));
  }, [mode, field, form]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["fields"] });

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const r = await fetch(mode === "new" ? "/api/fields" : `/api/fields/${fieldId}`, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(values)),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || (mode === "new" ? m.createFailed : m.updateFailed));
    },
    onSuccess: async (_d, values) => {
      await refresh();
      if (mode === "new") {
        toast(m.created, { type: "success" });
        router.push("/admin/fields");
      } else {
        form.reset(values);
        toast(m.updated, { type: "success" });
      }
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/fields/${fieldId}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || m.deleteFailed);
      }
    },
    onSuccess: async () => {
      await refresh();
      toast(m.deleted, { type: "success" });
      router.push("/admin/fields");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const v = form.values;
  const isSystem = Boolean(field?.isSystem);
  const notFound = mode === "edit" && !isLoading && !field;
  const readOnly = isSystem || notFound;
  const optionBased = v.type === "SELECT" || v.type === "MULTI_SELECT";
  const referenceBased = isReferenceTargetField(v.type);
  const referenceTargets = isEntityReferenceType(v.type)
    ? entityTypes.map((entityType) => ({ key: entityType.key ?? "", name: entityType.name })).filter((entityType) => entityType.key)
    : referenceObjects;
  const normalizedOptions = v.options.filter((o) => o.value.trim() && o.label.trim());

  return (
    <AdminDetailShell
      title={mode === "new" ? m.createTitle : field?.name ?? m.editTitlePlain}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: m.pageTitle, href: "/admin/fields" },
        { label: mode === "new" ? m.createTitle : field?.name ?? m.editTitlePlain },
      ]}
      isDirty={form.isDirty}
      isValid={v.name.trim().length > 0 && v.key.trim().length > 0 && (!referenceBased || v.type === "USER" || v.referenceObjectKey.trim().length > 0)}
      isSaving={saveMutation.isPending}
      onSave={() => saveMutation.mutate(v)}
      onDiscard={() => form.reset()}
      onDelete={mode === "edit" && field && !isSystem ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={`${m.delete}?`}
      deleteConfirmDescription={m.dangerZoneDescription}
      dangerZoneDescription={m.dangerZoneDescription}
      readOnly={readOnly}
    >
      {notFound ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
      ) : (
        <div className="space-y-5">
          {isSystem && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{m.systemReadOnly}</p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-[var(--color-text-secondary)]">{m.nameLabel}</span>
              <Input value={v.name} onChange={(e) => form.setField("name", e.target.value)} placeholder={m.namePlaceholder} disabled={readOnly} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--color-text-secondary)]">{m.keyLabel}</span>
              <Input value={v.key} onChange={(e) => form.setField("key", e.target.value)} placeholder={m.keyPlaceholder} disabled={readOnly} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--color-text-secondary)]">{m.typeLabel}</span>
              <select
                value={v.type}
                disabled={readOnly}
                onChange={(e) =>
                  {
                    const nextType = e.target.value as FieldType;
                    const nextObjectReference = isObjectReferenceType(nextType);
                    const nextEntityReference = isEntityReferenceType(nextType);
                    form.setValues((c) => ({
                      ...c,
                      type: nextType,
                      referenceObjectKey: nextObjectReference
                        ? c.referenceObjectKey || referenceObjects[0]?.key || ""
                        : nextEntityReference
                          ? c.referenceObjectKey || entityTypes.find((entityType) => entityType.key)?.key || ""
                          : "",
                      defaultSelectValue: "",
                      defaultMultiValues: [],
                      options: nextType === "SELECT" || nextType === "MULTI_SELECT" ? c.options : [emptyOption()],
                    }));
                  }
                }
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:opacity-50"
              >
                {FIELD_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {referenceBased && v.type !== "USER" && (
            <label className="block max-w-md space-y-1">
              <span className="text-xs text-[var(--color-text-secondary)]">{m.referenceTargetLabel}</span>
              <select
                value={v.referenceObjectKey}
                disabled={readOnly}
                onChange={(e) => form.setField("referenceObjectKey", e.target.value)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:opacity-50"
              >
                <option value="">{m.referenceTargetPlaceholder}</option>
                {referenceTargets.map((referenceTarget) => (
                  <option key={referenceTarget.key} value={referenceTarget.key}>
                    {referenceTarget.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {optionBased && !readOnly && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.optionsTitle}</h3>
                <Button type="button" size="sm" variant="secondary" onClick={() => form.setValues((c) => ({ ...c, options: [...c.options, emptyOption()] }))}>
                  {m.addOption}
                </Button>
              </div>
              <div className="space-y-2">
                {v.options.map((option, index) => (
                  <div key={index} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 md:grid-cols-[1fr_1fr_120px_auto]">
                    <Input value={option.label} placeholder={m.optionLabelPlaceholder} onChange={(e) => form.setValues((c) => ({ ...c, options: c.options.map((o, i) => (i === index ? { ...o, label: e.target.value } : o)) }))} />
                    <Input value={option.value} placeholder={m.optionValuePlaceholder} onChange={(e) => form.setValues((c) => ({ ...c, options: c.options.map((o, i) => (i === index ? { ...o, value: e.target.value } : o)) }))} />
                    <Input value={option.color ?? ""} placeholder="#3b82f6" onChange={(e) => form.setValues((c) => ({ ...c, options: c.options.map((o, i) => (i === index ? { ...o, color: e.target.value } : o)) }))} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => form.setValues((c) => ({ ...c, options: c.options.length === 1 ? [emptyOption()] : c.options.filter((_, i) => i !== index) }))}>
                      {m.removeOption}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{m.defaultValueTitle}</p>
                {v.type === "SELECT" ? (
                  <select
                    value={v.defaultSelectValue}
                    onChange={(e) => form.setField("defaultSelectValue", e.target.value)}
                    className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
                  >
                    <option value="">{m.noDefault}</option>
                    {normalizedOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    {normalizedOptions.length === 0 && <p className="text-xs text-[var(--color-text-tertiary)]">{m.addOptionsFirst}</p>}
                    {normalizedOptions.map((o) => {
                      const checked = v.defaultMultiValues.includes(o.value);
                      return (
                        <label key={o.value} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => form.setValues((c) => ({ ...c, defaultMultiValues: checked ? c.defaultMultiValues.filter((x) => x !== o.value) : [...c.defaultMultiValues, o.value] }))}
                          />
                          <span>{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Read-only system field: surface options/default as badges */}
          {readOnly && optionBased && normalizedOptions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {normalizedOptions.map((o) => (
                <Badge key={o.value} color={o.color ?? undefined}>
                  {o.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminDetailShell>
  );
}
