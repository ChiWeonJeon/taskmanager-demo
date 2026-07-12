"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/task/task-icons";
import { FieldSchemaFieldEntry, IssueTypeField } from "@/components/task/types";
import {
  FIELD_SCHEMA_CANONICAL_ID,
  LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET,
  LOCKED_SYSTEM_FIELD_KEY_SET,
  getCanonicalFieldSortOrder,
  isObjectRecordSchemaFieldType,
  isObjectRecordTitleFieldKey,
  parseFieldOptions,
  resolveObjectSchemaFieldRequired,
  resolveSchemaFieldRequired,
} from "@/lib/field-schema";
import { useToast } from "@/lib/toast";
import { useStagedForm } from "@/lib/admin/use-staged-form";

interface FieldSchemaRecord {
  id: string;
  name: string;
  createdAt: string;
  fields: FieldSchemaFieldEntry[];
  issueTypes: { id: string; name: string }[];
  objectDefs: { id: string; key: string; name: string }[];
}

interface FormState {
  name: string;
  customFieldIds: string[];
  customFieldDefaults: Record<string, string | null>;
  customFieldRequired: Record<string, boolean>;
}

type SchemaUsage = "entity" | "object";

const EMPTY_FORM: FormState = { name: "", customFieldIds: [], customFieldDefaults: {}, customFieldRequired: {} };
const DEFAULT_VALUE_FIELD_TYPES = new Set(["SELECT", "MULTI_SELECT", "TEXT", "URL", "NUMBER", "DATE"]);

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function appendFieldSchemaId(path: string, schemaId: string) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("fieldSchemaId", schemaId);
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function parseDefaultDisplay(stored: string | null | undefined) {
  if (!stored) return "";
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed === "string") return parsed;
    if (typeof parsed === "number") return String(parsed);
    return "";
  } catch {
    return "";
  }
}

function parseDefaultArray(stored: string | null | undefined) {
  if (!stored) return [] as string[];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function FieldSchemaEditor({ schemaId }: { schemaId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const fs = messages.admin.fieldSchemas;
  const [addFieldId, setAddFieldId] = useState("");

  const isEdit = Boolean(schemaId);
  const explicitUsage = searchParams.get("usage") === "object" ? "object" : null;
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const form = useStagedForm<FormState>(EMPTY_FORM);

  const { data: fields = [], isPending: fieldsPending, error: fieldsError } = useQuery<IssueTypeField[]>({
    queryKey: ["fields"],
    queryFn: async () => {
      const response = await fetch("/api/fields");
      if (!response.ok) throw new Error(fs.loadFailed);
      return response.json();
    },
  });

  const { data: fieldSchema, isPending: schemaPending, error: schemaError } = useQuery<FieldSchemaRecord>({
    queryKey: ["field-schemas", schemaId],
    enabled: Boolean(schemaId),
    queryFn: async () => {
      const response = await fetch(`/api/field-schemas/${schemaId}`);
      if (!response.ok) throw new Error(fs.loadFailed);
      return response.json();
    },
  });

  const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const schemaUsage: SchemaUsage = explicitUsage === "object" || (fieldSchema?.objectDefs.length ?? 0) > 0 ? "object" : "entity";
  const lockedFields = useMemo(
    () => {
      if (schemaUsage === "object") {
        const existingTitleFields = fieldSchema?.fields
          .map((entry) => entry.field)
          .filter((field) => isObjectRecordTitleFieldKey(field.key)) ?? [];
        if (existingTitleFields.length > 0) return existingTitleFields;

        const objectTitle = fields.find((field) => field.key === "object_record_title")
          ?? fields.find((field) => field.key === "title");
        return objectTitle ? [objectTitle] : [];
      }

      return fields
        .filter((field) => LOCKED_SYSTEM_FIELD_KEY_SET.has(field.key))
        .sort((l, r) => getCanonicalFieldSortOrder(l.key) - getCanonicalFieldSortOrder(r.key));
    },
    [fieldSchema?.fields, fields, schemaUsage],
  );
  const lockedFieldIds = useMemo(() => lockedFields.map((f) => f.id), [lockedFields]);
  const lockedFieldIdSet = useMemo(() => new Set(lockedFieldIds), [lockedFieldIds]);

  // Sync the staged baseline once fields (+ schema in edit mode) have loaded.
  const syncedRef = useRef<string>("");
  useEffect(() => {
    if (fields.length === 0) return;
    if (isEdit) {
      if (!fieldSchema) return;
      const key = `${fieldSchema.id}:${schemaUsage}:${fieldSchema.fields.map((e) => `${e.field.id}=${e.defaultValue ?? ""}:${e.isRequired ? "1" : "0"}`).join(",")}:${fieldSchema.name}`;
      if (syncedRef.current === key) return;
      syncedRef.current = key;
      const customFieldIds = fieldSchema.fields.map((e) => e.field.id).filter((id) => !lockedFieldIdSet.has(id));
      const customFieldDefaults: Record<string, string | null> = {};
      const customFieldRequired: Record<string, boolean> = {};
      for (const entry of fieldSchema.fields) {
        if (lockedFieldIdSet.has(entry.field.id)) continue;
        customFieldDefaults[entry.field.id] = entry.defaultValue ?? null;
        customFieldRequired[entry.field.id] = Boolean(entry.isRequired);
      }
      form.reset({ name: fieldSchema.name, customFieldIds, customFieldDefaults, customFieldRequired });
    } else if (syncedRef.current !== "new") {
      syncedRef.current = "new";
      const titleField = schemaUsage === "object"
        ? fields.find((field) => field.key === "object_record_title") ?? fields.find((field) => field.key === "title")
        : null;
      form.reset(titleField ? { ...EMPTY_FORM } : EMPTY_FORM);
    }
  }, [fields, fields.length, isEdit, fieldSchema, lockedFieldIdSet, form, schemaUsage]);

  const { name, customFieldIds, customFieldDefaults, customFieldRequired } = form.values;

  const selectedFields = useMemo(
    () => [
      ...lockedFields,
      ...customFieldIds.map((id) => fieldsById.get(id)).filter((f): f is IssueTypeField => Boolean(f)),
    ],
    [customFieldIds, fieldsById, lockedFields],
  );
  const availableFields = useMemo(
    () =>
      fields
        .filter((field) => {
          if (lockedFieldIdSet.has(field.id) || customFieldIds.includes(field.id)) return false;
          if (schemaUsage === "object") {
            return !field.isSystem && isObjectRecordSchemaFieldType(field.type);
          }
          return !LOCKED_SYSTEM_FIELD_KEY_SET.has(field.key);
        })
        .sort((l, r) => l.name.localeCompare(r.name)),
    [customFieldIds, fields, lockedFieldIdSet, schemaUsage],
  );
  const resolvedAddFieldId = availableFields.some((f) => f.id === addFieldId) ? addFieldId : availableFields[0]?.id ?? "";

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const fieldIds = [...lockedFieldIds, ...values.customFieldIds];
      const fieldRequired = Object.fromEntries([
        ...lockedFieldIds.map((fieldId) => [fieldId, true] as const),
        ...values.customFieldIds.map((fieldId) => [fieldId, Boolean(values.customFieldRequired[fieldId])] as const),
      ]);
      const response = await fetch(isEdit ? `/api/field-schemas/${schemaId}` : "/api/field-schemas", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          usage: schemaUsage,
          fieldIds,
          fieldDefaults: values.customFieldDefaults,
          fieldRequired,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || (isEdit ? fs.updateFailed : fs.createFailed));
      }
      return response.json() as Promise<FieldSchemaRecord>;
    },
    onSuccess: async (saved, values) => {
      await queryClient.invalidateQueries({ queryKey: ["field-schemas"] });
      await queryClient.invalidateQueries({ queryKey: ["field-schemas", saved.id] });
      toast(isEdit ? fs.updateSuccess : fs.createSuccess, { type: "success" });
      if (returnTo) {
        router.push(isEdit ? returnTo : appendFieldSchemaId(returnTo, saved.id));
      } else if (isEdit) {
        form.reset(values);
      } else {
        router.push(`/admin/field-schemas/${saved.id}`);
      }
    },
    onError: (error: Error) => toast(error.message || fs.saveFailed, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/field-schemas/${schemaId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || fs.deleteBlocked);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["field-schemas"] });
      toast(fs.deleteSuccess, { type: "success" });
      router.push("/admin/field-schemas");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  function moveCustomField(fieldId: string, direction: -1 | 1) {
    form.setValues((current) => {
      const next = [...current.customFieldIds];
      const index = next.indexOf(fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, customFieldIds: next };
    });
  }

  function removeCustomField(fieldId: string) {
    form.setValues((current) => {
      const nextDefaults = { ...current.customFieldDefaults };
      const nextRequired = { ...current.customFieldRequired };
      delete nextDefaults[fieldId];
      delete nextRequired[fieldId];
      return {
        ...current,
        customFieldIds: current.customFieldIds.filter((id) => id !== fieldId),
        customFieldDefaults: nextDefaults,
        customFieldRequired: nextRequired,
      };
    });
  }

  function setCustomFieldDefault(fieldId: string, rawValue: string) {
    form.setValues((current) => ({
      ...current,
      customFieldDefaults: { ...current.customFieldDefaults, [fieldId]: rawValue === "" ? null : JSON.stringify(rawValue) },
    }));
  }

  function toggleCustomFieldDefaultOption(fieldId: string, optionValue: string) {
    form.setValues((current) => {
      const selected = new Set(parseDefaultArray(current.customFieldDefaults[fieldId]));
      if (selected.has(optionValue)) selected.delete(optionValue);
      else selected.add(optionValue);
      const arr = Array.from(selected);
      return {
        ...current,
        customFieldDefaults: { ...current.customFieldDefaults, [fieldId]: arr.length > 0 ? JSON.stringify(arr) : null },
      };
    });
  }

  function setCustomFieldRequired(fieldId: string, required: boolean) {
    form.setValues((current) => ({
      ...current,
      customFieldRequired: { ...current.customFieldRequired, [fieldId]: required },
    }));
  }

  function addField() {
    if (!resolvedAddFieldId) return;
    form.setValues((current) =>
      current.customFieldIds.includes(resolvedAddFieldId)
        ? current
        : { ...current, customFieldIds: [...current.customFieldIds, resolvedAddFieldId] },
    );
    setAddFieldId("");
  }

  const loadError = fieldsError || schemaError;
  const loading = fieldsPending || (isEdit && schemaPending);
  const canonicalLocked = fieldSchema?.id === FIELD_SCHEMA_CANONICAL_ID;
  const canDelete = isEdit && fieldSchema && !canonicalLocked && fieldSchema.issueTypes.length === 0 && fieldSchema.objectDefs.length === 0;

  return (
    <AdminDetailShell
      title={isEdit ? fs.editTitle : fs.newTitle}
      breadcrumbs={[
        { label: messages.admin.breadcrumbs.admin, href: "/admin" },
        { label: messages.admin.breadcrumbs.fieldSchemas, href: "/admin/field-schemas" },
        { label: isEdit ? messages.admin.breadcrumbs.editFieldSchema : messages.admin.breadcrumbs.newFieldSchema },
      ]}
      isDirty={form.isDirty}
      isValid={name.trim().length > 0}
      isSaving={saveMutation.isPending}
      onSave={() => saveMutation.mutate(form.values)}
      onDiscard={() => form.reset()}
      onDelete={canDelete ? () => deleteMutation.mutate() : undefined}
      deleting={deleteMutation.isPending}
      deleteConfirmTitle={fs.deleteConfirm}
      deleteConfirmDescription={messages.adminCommon.confirmDeleteBody}
      readOnly={loading || Boolean(loadError)}
    >
      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)]" />
          <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)]" />
        </div>
      ) : loadError ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-light)]/40 p-4 text-sm text-[var(--color-danger)]">
          {fs.loadFailed}
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{fs.name}</span>
              <input
                type="text"
                value={name}
                onChange={(event) => form.setField("name", event.target.value)}
                placeholder={fs.namePlaceholder}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </label>
            {isEdit && fieldSchema && (fieldSchema.issueTypes.length > 0 || fieldSchema.objectDefs.length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">{fs.issueTypes}</div>
                  <div className="flex flex-wrap gap-1">
                    {fieldSchema.issueTypes.length === 0 ? (
                      <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{messages.common.none}</span>
                    ) : fieldSchema.issueTypes.map((issueType) => (
                      <Badge key={issueType.id} variant="warning">
                        {issueType.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">{fs.objectDefs}</div>
                  <div className="flex flex-wrap gap-1">
                    {fieldSchema.objectDefs.length === 0 ? (
                      <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{messages.common.none}</span>
                    ) : fieldSchema.objectDefs.map((objectDef) => (
                      <Badge key={objectDef.id} variant="accent">
                        {objectDef.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{fs.fields}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {schemaUsage === "object" ? fs.objectSchemaHint : fs.cannotModifyLockedField}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={resolvedAddFieldId}
                  onChange={(event) => setAddFieldId(event.target.value)}
                  disabled={availableFields.length === 0}
                  className="h-9 min-w-[220px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)]"
                >
                  {availableFields.length === 0 ? (
                    <option value="">{fs.noAvailableFields}</option>
                  ) : (
                    availableFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))
                  )}
                </select>
                <Button type="button" size="sm" variant="secondary" onClick={addField} disabled={!resolvedAddFieldId}>
                  {fs.addField}
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <table className="min-w-full divide-y divide-[var(--color-border)] text-left">
                <thead className="bg-[var(--color-bg-secondary)] text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">{fs.name}</th>
                    <th className="px-4 py-3 font-medium">{fs.fields}</th>
                    <th className="px-4 py-3 font-medium">{fs.required}</th>
                    <th className="px-4 py-3 font-medium">{fs.defaultValue}</th>
                    <th className="px-4 py-3 font-medium">{fs.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-bg-primary)]">
                  {selectedFields.map((field) => {
                    const customIndex = customFieldIds.indexOf(field.id);
                    const isLockedField = lockedFieldIdSet.has(field.id);
                    const requestedRequired = isLockedField ? true : Boolean(customFieldRequired[field.id]);
                    const isRequiredField = schemaUsage === "object"
                      ? resolveObjectSchemaFieldRequired(field.key, requestedRequired, field.isRequired)
                      : resolveSchemaFieldRequired(field.key, requestedRequired, field.isRequired);
                    const isReadOnlyField = schemaUsage === "entity" && LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key);
                    const canToggleRequired = !isLockedField && !field.isRequired;

                    return (
                      <tr key={field.id}>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div className="font-medium text-[var(--color-text-primary)]">{field.name}</div>
                            <div className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{field.key}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Badge>{field.type}</Badge>
                            {isLockedField && <Badge variant="accent">{fs.locked}</Badge>}
                            {isRequiredField && <Badge variant="warning">{fs.required}</Badge>}
                            {isReadOnlyField && <Badge variant="default">{fs.readOnly}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                            <input
                              type="checkbox"
                              checked={isRequiredField}
                              disabled={!canToggleRequired}
                              onChange={(event) => setCustomFieldRequired(field.id, event.target.checked)}
                              className="h-4 w-4 flex-shrink-0 accent-[var(--color-accent)] disabled:opacity-40"
                            />
                            <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                              {isRequiredField ? fs.required : fs.optional}
                            </span>
                          </label>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {isLockedField || !DEFAULT_VALUE_FIELD_TYPES.has(field.type) ? (
                            <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">—</span>
                          ) : field.type === "SELECT" ? (
                            <select
                              value={parseDefaultDisplay(customFieldDefaults[field.id])}
                              onChange={(event) => setCustomFieldDefault(field.id, event.target.value)}
                              className="h-9 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)]"
                            >
                              <option value="">{fs.noDefault}</option>
                              {parseFieldOptions(field.options).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "MULTI_SELECT" ? (
                            (() => {
                              const selected = new Set(parseDefaultArray(customFieldDefaults[field.id]));
                              const options = parseFieldOptions(field.options);
                              if (options.length === 0) {
                                return <span className="text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{fs.noDefault}</span>;
                              }
                              return (
                                <div className="flex max-h-28 min-w-[160px] flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5">
                                  {options.map((option) => (
                                    <label key={option.value} className="flex cursor-pointer items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                                      <input
                                        type="checkbox"
                                        checked={selected.has(option.value)}
                                        onChange={() => toggleCustomFieldDefaultOption(field.id, option.value)}
                                        className="h-3 w-3 flex-shrink-0 accent-[var(--color-accent)]"
                                      />
                                      <span className="truncate">{option.label}</span>
                                    </label>
                                  ))}
                                </div>
                              );
                            })()
                          ) : (
                            <input
                              type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
                              value={parseDefaultDisplay(customFieldDefaults[field.id])}
                              onChange={(event) => setCustomFieldDefault(field.id, event.target.value)}
                              placeholder={fs.noDefault}
                              className="h-9 min-w-[160px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
                            {!isLockedField ? (
                              <>
                                <Button type="button" size="sm" variant="ghost" onClick={() => moveCustomField(field.id, -1)} disabled={customIndex <= 0} aria-label={fs.moveUp}>
                                  <ArrowUpIcon className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => moveCustomField(field.id, 1)} disabled={customIndex < 0 || customIndex >= customFieldIds.length - 1} aria-label={fs.moveDown}>
                                  <ArrowDownIcon className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeCustomField(field.id)}>
                                  {fs.removeField}
                                </Button>
                              </>
                            ) : (
                              <span className="inline-flex h-8 items-center text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{fs.locked}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminDetailShell>
  );
}
