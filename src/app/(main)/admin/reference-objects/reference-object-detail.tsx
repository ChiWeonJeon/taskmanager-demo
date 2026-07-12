"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminDetailShell } from "@/components/admin/admin-detail-shell";
import { DetailFieldRow, DetailPanelShell, SectionCard } from "@/components/shared/detail-panel-shell";
import { useI18n } from "@/components/shared/locale-provider";
import type { FieldSchemaOption, IssueTypeField } from "@/components/task/types";
import { getReferenceObjectKey, isMultiReferenceField, useObjectReferenceOptions } from "@/components/task/use-object-reference-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useStagedForm } from "@/lib/admin/use-staged-form";
import { isFieldValuePresent, parseFieldOptions, parseStoredFieldValue, resolveObjectSchemaFieldRequired } from "@/lib/field-schema";
import { useToast } from "@/lib/toast";

interface ReferenceObjectRecord {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  fieldSchemaId: string;
  isSystem: boolean;
  updatedAt?: string;
  _count?: { records: number };
}

interface ObjectRecordItem {
  id: string;
  key: string;
  value: string;
  title: string;
  label?: string;
  color?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  fieldValues?: { fieldId: string; value: string; field: IssueTypeField }[];
}

interface FormState {
  key: string;
  name: string;
  icon: string;
  color: string;
  fieldSchemaId: string;
}

type DynamicFieldValue = string | string[] | null;

const EMPTY: FormState = { key: "", name: "", icon: "", color: "#6b7280", fieldSchemaId: "" };

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isObjectRecordTitleField(field: Pick<IssueTypeField, "key">) {
  return field.key === "object_record_title" || field.key === "title";
}

function toForm(objectDef: ReferenceObjectRecord): FormState {
  return {
    key: objectDef.key,
    name: objectDef.name,
    icon: objectDef.icon ?? "",
    color: objectDef.color ?? "#6b7280",
    fieldSchemaId: objectDef.fieldSchemaId,
  };
}

function getSchemaFields(schema: FieldSchemaOption | null) {
  return (
    schema?.fields.map((entry) => ({
      ...entry.field,
      isRequired: resolveObjectSchemaFieldRequired(entry.field.key, entry.isRequired, entry.field.isRequired),
      defaultValue: entry.defaultValue ?? entry.field.defaultValue ?? null,
    })) ?? []
  ) as IssueTypeField[];
}

function sanitizeReturnTo(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/admin/reference-objects";
}

function getRecordFields(schema: FieldSchemaOption | null) {
  return getSchemaFields(schema).filter((field) => !isObjectRecordTitleField(field));
}

function getDefaultFieldValues(fields: IssueTypeField[]) {
  const next: Record<string, DynamicFieldValue> = {};
  for (const field of fields) {
    const parsed = parseStoredFieldValue(field, field.defaultValue) as DynamicFieldValue;
    if (isFieldValuePresent(parsed ?? undefined)) next[field.id] = parsed;
  }
  return next;
}

function getRecordFieldValues(record: ObjectRecordItem, fields: IssueTypeField[]) {
  const next = getDefaultFieldValues(fields);
  for (const fieldValue of record.fieldValues ?? []) {
    const field = fields.find((item) => item.id === fieldValue.fieldId) ?? fieldValue.field;
    if (isObjectRecordTitleField(field)) continue;
    next[fieldValue.fieldId] = parseStoredFieldValue(field, fieldValue.value) as DynamicFieldValue;
  }
  return next;
}

function hasFieldValueOrDefault(field: IssueTypeField, values: Record<string, DynamicFieldValue>) {
  return isFieldValuePresent(values[field.id] ?? undefined)
    || isFieldValuePresent(parseStoredFieldValue(field, field.defaultValue) as DynamicFieldValue);
}

export function ReferenceObjectDetail({ mode, objectKey }: { mode: "new" | "edit"; objectKey?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { messages } = useI18n();
  const m = messages.admin.objectTypes;

  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [recordTitle, setRecordTitle] = useState("");
  const [recordKey, setRecordKey] = useState("");
  const [recordParentId, setRecordParentId] = useState("");
  const [recordSortOrder, setRecordSortOrder] = useState("0");
  const [recordFieldValues, setRecordFieldValues] = useState<Record<string, DynamicFieldValue>>({});

  const { data: referenceObjects = [], isLoading } = useQuery<ReferenceObjectRecord[]>({
    queryKey: ["reference-objects", "admin"],
    queryFn: async () => {
      const response = await fetch("/api/reference-objects?all=1");
      if (!response.ok) throw new Error(m.loadFailed);
      return response.json();
    },
    enabled: mode === "edit",
  });

  const referenceObject = mode === "edit"
    ? referenceObjects.find((item) => item.key === objectKey)
    : undefined;

  const { data: recordsBody, isLoading: isLoadingRecords } = useQuery<{ records: ObjectRecordItem[] }>({
    queryKey: ["reference-object-records", objectKey],
    queryFn: async () => {
      const response = await fetch(`/api/reference-objects/${encodeURIComponent(objectKey ?? "")}/records?limit=200`);
      if (!response.ok) throw new Error(m.loadFailed);
      return response.json();
    },
    enabled: mode === "edit" && Boolean(referenceObject),
  });
  const records = recordsBody?.records ?? [];

  const { data: fieldSchemas = [] } = useQuery<FieldSchemaOption[]>({
    queryKey: ["field-schemas"],
    queryFn: async () => {
      const response = await fetch("/api/field-schemas");
      if (!response.ok) throw new Error(m.loadFailed);
      return response.json();
    },
  });

  const form = useStagedForm<FormState>(mode === "edit" && referenceObject ? toForm(referenceObject) : EMPTY);
  const syncedRef = useRef("");
  useEffect(() => {
    if (mode !== "edit") {
      if (syncedRef.current !== "new") {
        syncedRef.current = "new";
        form.reset(EMPTY);
      }
      return;
    }
    if (!referenceObject) return;
    const key = `${referenceObject.id}:${referenceObject.updatedAt ?? ""}`;
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    form.reset(toForm(referenceObject));
  }, [mode, referenceObject, form]);

  const selectedFieldSchema = fieldSchemas.find((schema) => schema.id === form.values.fieldSchemaId) ?? null;
  const recordFields = getRecordFields(selectedFieldSchema);
  const { data: referenceOptionsByTarget = {} } = useObjectReferenceOptions(recordFields);
  const selectedRecord = activeRecordId ? records.find((record) => record.id === activeRecordId) ?? null : null;
  const recordPanelOpen = isCreatingRecord || Boolean(activeRecordId);
  const isSystem = Boolean(referenceObject?.isSystem);
  const notFound = mode === "edit" && !isLoading && !referenceObject;
  const readOnly = notFound || isSystem;
  const activeRecordCount = records.length || referenceObject?._count?.records || 0;
  const schemaChangeLocked = mode === "edit" && activeRecordCount > 0;
  const currentPath = mode === "edit" && objectKey
    ? `/admin/reference-objects/${encodeURIComponent(objectKey)}`
    : "/admin/reference-objects/new";
  const returnTo = sanitizeReturnTo(currentPath);
  const editSchemaHref = form.values.fieldSchemaId
    ? `/admin/field-schemas/${encodeURIComponent(form.values.fieldSchemaId)}?usage=object&returnTo=${encodeURIComponent(returnTo)}`
    : "";
  const newSchemaHref = `/admin/field-schemas/new?usage=object&returnTo=${encodeURIComponent(returnTo)}`;
  const isValid = form.values.name.trim().length > 0
    && form.values.fieldSchemaId.trim().length > 0
    && (mode === "edit" || normalizeKey(form.values.key || form.values.name).length > 0);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reference-objects"] }),
      queryClient.invalidateQueries({ queryKey: ["object-types"] }),
      queryClient.invalidateQueries({ queryKey: ["reference-object-records", objectKey] }),
      queryClient.invalidateQueries({ queryKey: ["object-reference-options"] }),
    ]);

  useEffect(() => {
    const requestedSchemaId = searchParams.get("fieldSchemaId");
    if (!requestedSchemaId || readOnly || schemaChangeLocked) return;
    if (form.values.fieldSchemaId === requestedSchemaId) return;
    if (!fieldSchemas.some((schema) => schema.id === requestedSchemaId)) return;
    form.setField("fieldSchemaId", requestedSchemaId);
  }, [fieldSchemas, form, readOnly, schemaChangeLocked, searchParams]);

  const createMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const response = await fetch("/api/reference-objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: normalizeKey(values.key || values.name),
          name: values.name.trim(),
          icon: values.icon.trim() || null,
          color: values.color.trim() || null,
          fieldSchemaId: values.fieldSchemaId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.createFailed);
      return body as ReferenceObjectRecord;
    },
    onSuccess: async (created) => {
      await invalidate();
      toast(m.created, { type: "success" });
      router.push(`/admin/reference-objects/${encodeURIComponent(created.key)}`);
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const response = await fetch(`/api/reference-objects/${encodeURIComponent(objectKey ?? "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          icon: values.icon.trim() || null,
          color: values.color.trim() || null,
          fieldSchemaId: values.fieldSchemaId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.updateFailed);
      return body as ReferenceObjectRecord;
    },
    onSuccess: async (updated) => {
      await invalidate();
      form.reset(toForm(updated));
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/reference-objects/${encodeURIComponent(objectKey ?? "")}`, { method: "DELETE" });
      if (response.status === 204) return;
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.deleteFailed);
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.deleted, { type: "success" });
      router.push("/admin/reference-objects");
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const closeRecordPanel = () => {
    setActiveRecordId(null);
    setIsCreatingRecord(false);
  };

  const openCreateRecord = () => {
    setActiveRecordId(null);
    setIsCreatingRecord(true);
    setRecordTitle("");
    setRecordKey("");
    setRecordParentId("");
    setRecordSortOrder("0");
    setRecordFieldValues(getDefaultFieldValues(recordFields));
  };

  const openEditRecord = (record: ObjectRecordItem) => {
    setIsCreatingRecord(false);
    setActiveRecordId(record.id);
    setRecordTitle(record.title);
    setRecordKey(record.key);
    setRecordParentId(record.parentId ?? "");
    setRecordSortOrder(String(record.sortOrder ?? 0));
    setRecordFieldValues(getRecordFieldValues(record, recordFields));
  };

  const ensureRequiredRecordFields = () => {
    for (const field of recordFields) {
      if (field.isRequired && !hasFieldValueOrDefault(field, recordFieldValues)) {
        throw new Error(`${field.name} ${m.requiredSuffix}`);
      }
    }
  };

  const recordPayload = () => ({
    title: recordTitle.trim(),
    key: normalizeKey(recordKey || recordTitle),
    parentId: recordParentId || null,
    sortOrder: Number.parseInt(recordSortOrder, 10) || 0,
    fieldValues: Object.fromEntries(
      Object.entries(recordFieldValues).filter(([, value]) => isFieldValuePresent(value ?? undefined)),
    ),
  });

  const createRecordMutation = useMutation({
    mutationFn: async () => {
      ensureRequiredRecordFields();
      const response = await fetch(`/api/reference-objects/${encodeURIComponent(objectKey ?? "")}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordPayload()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.createFailed);
    },
    onSuccess: async () => {
      closeRecordPanel();
      await invalidate();
      toast(m.created, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const updateRecordMutation = useMutation({
    mutationFn: async () => {
      ensureRequiredRecordFields();
      const response = await fetch(`/api/reference-objects/${encodeURIComponent(objectKey ?? "")}/records/${encodeURIComponent(activeRecordId ?? "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordPayload()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.updateFailed);
    },
    onSuccess: async () => {
      await invalidate();
      toast(m.updated, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const deleteRecordMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/reference-objects/${encodeURIComponent(objectKey ?? "")}/records/${encodeURIComponent(activeRecordId ?? "")}`, {
        method: "DELETE",
      });
      if (response.status === 204) return;
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || m.deleteFailed);
    },
    onSuccess: async () => {
      closeRecordPanel();
      await invalidate();
      toast(m.deleted, { type: "success" });
    },
    onError: (error: Error) => toast(error.message, { type: "error", sticky: true }),
  });

  const updateRecordFieldValue = (fieldId: string, value: DynamicFieldValue) => {
    setRecordFieldValues((current) => ({ ...current, [fieldId]: value }));
  };

  const renderRecordField = (field: IssueTypeField) => {
    const currentValue = recordFieldValues[field.id];
    const options = parseFieldOptions(field.options);
    const labelNode = (
      <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
        {field.name}
        {field.isRequired && <span className="ml-1 text-[var(--color-danger)]">*</span>}
      </label>
    );

    switch (field.type) {
      case "TEXT":
      case "URL":
      case "NUMBER":
        return (
          <div key={field.id}>
            {labelNode}
            <Input
              type={field.type === "NUMBER" ? "number" : field.type === "URL" ? "url" : "text"}
              value={typeof currentValue === "string" ? currentValue : ""}
              onChange={(event) => updateRecordFieldValue(field.id, event.target.value)}
            />
          </div>
        );
      case "DATE":
        return (
          <div key={field.id}>
            {labelNode}
            <Input
              type="date"
              value={typeof currentValue === "string" ? currentValue : ""}
              onChange={(event) => updateRecordFieldValue(field.id, event.target.value)}
            />
          </div>
        );
      case "SELECT":
      case "USER":
      case "REFERENCE":
      case "OBJECT_REF":
      case "ENTITY_REF": {
        const referenceObjectKey = getReferenceObjectKey(field);
        const selectOptions = field.type === "SELECT" ? options : referenceOptionsByTarget[referenceObjectKey] ?? [];
        return (
          <div key={field.id}>
            {labelNode}
            <Combobox
              className="w-full"
              options={selectOptions}
              value={typeof currentValue === "string" ? currentValue : ""}
              onChange={(value) => updateRecordFieldValue(field.id, value)}
              renderTrigger={(option) => (
                <span className="flex h-9 w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)]">
                  {option?.color ? <Badge color={option.color}>{option.label}</Badge> : <span className="truncate">{option?.label ?? messages.common.select}</span>}
                </span>
              )}
            />
          </div>
        );
      }
      case "MULTI_SELECT":
      case "MULTI_REFERENCE":
      case "MULTI_OBJECT_REF":
      case "MULTI_ENTITY_REF": {
        const selectedSet = new Set(Array.isArray(currentValue) ? currentValue : []);
        const referenceObjectKey = getReferenceObjectKey(field);
        const fieldOptions = isMultiReferenceField(field) ? referenceOptionsByTarget[referenceObjectKey] ?? [] : options;
        const toggleOption = (value: string) => {
          const next = new Set(selectedSet);
          if (next.has(value)) next.delete(value);
          else next.add(value);
          updateRecordFieldValue(field.id, Array.from(next));
        };
        return (
          <div key={field.id}>
            {labelNode}
            <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2">
              {fieldOptions.length === 0 ? (
                <span className="text-xs text-[var(--color-text-secondary)]">{m.noRecordFieldChoices}</span>
              ) : fieldOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 rounded px-1 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggleOption(option.value)}
                    className="h-3.5 w-3.5 flex-shrink-0 accent-[var(--color-accent)]"
                  />
                  {option.color ? <Badge color={option.color}>{option.label}</Badge> : <span className="truncate">{option.label}</span>}
                </label>
              ))}
            </div>
          </div>
        );
      }
      default:
        return (
          <div key={field.id}>
            {labelNode}
            <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
              {m.unsupportedRecordFieldType}
            </p>
          </div>
        );
    }
  };

  const recordCanSave = recordTitle.trim().length > 0 && normalizeKey(recordKey || recordTitle).length > 0;

  return (
    <>
      <AdminDetailShell
        title={mode === "new" ? m.create : referenceObject?.name ?? m.editTitle}
        breadcrumbs={[
          { label: messages.admin.breadcrumbs.admin, href: "/admin" },
          { label: m.title, href: "/admin/reference-objects" },
          { label: mode === "new" ? m.create : referenceObject?.name ?? m.editTitle },
        ]}
        isDirty={form.isDirty}
        isValid={isValid}
        isSaving={createMutation.isPending || updateMutation.isPending}
        onSave={() => (mode === "new" ? createMutation.mutate(form.values) : updateMutation.mutate(form.values))}
        onDiscard={() => form.reset()}
        onDelete={mode === "edit" && referenceObject && !isSystem ? () => deleteMutation.mutate() : undefined}
        deleting={deleteMutation.isPending}
        deleteConfirmTitle={m.confirmDelete}
        deleteConfirmDescription={m.dangerZoneDescription}
        dangerZoneDescription={m.dangerZoneDescription}
        readOnly={readOnly}
      >
        {notFound ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{m.notFound}</p>
        ) : (
          <div className="space-y-5">
            {isSystem && (
              <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                {m.systemHint}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={m.name}>
                <Input value={form.values.name} onChange={(event) => form.setField("name", event.target.value)} placeholder={m.namePlaceholder} disabled={readOnly} />
              </Field>
              <Field label={m.key}>
                <Input value={form.values.key} onChange={(event) => form.setField("key", normalizeKey(event.target.value))} placeholder={m.keyPlaceholder} disabled={readOnly || mode === "edit"} />
              </Field>
              <Field label={m.icon}>
                <Input value={form.values.icon} onChange={(event) => form.setField("icon", event.target.value)} placeholder={m.iconPlaceholder} disabled={readOnly} />
              </Field>
              <Field label={m.color}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.values.color || "#6b7280"}
                    onChange={(event) => form.setField("color", event.target.value)}
                    disabled={readOnly}
                    className="h-9 w-12 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1"
                  />
                  <Input value={form.values.color} onChange={(event) => form.setField("color", event.target.value)} placeholder="#6b7280" disabled={readOnly} />
                </div>
              </Field>
              <Field label={m.fieldSchema}>
                <div className="space-y-2">
                  <select
                    value={form.values.fieldSchemaId}
                    onChange={(event) => form.setField("fieldSchemaId", event.target.value)}
                    disabled={readOnly || schemaChangeLocked}
                    className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)] disabled:bg-[var(--color-bg-secondary)] disabled:text-[var(--color-text-tertiary)]"
                  >
                    <option value="">{m.fieldSchemaRequired}</option>
                    {fieldSchemas.map((schema) => (
                      <option key={schema.id} value={schema.id}>{schema.name}</option>
                    ))}
                  </select>
                  {schemaChangeLocked && (
                    <p className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">{m.schemaChangeLockedHint}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {editSchemaHref ? (
                      <Link href={editSchemaHref}>
                        <Button type="button" size="sm" variant="secondary">
                          {m.editFieldSchema}
                        </Button>
                      </Link>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled>
                        {m.editFieldSchema}
                      </Button>
                    )}
                    {readOnly || schemaChangeLocked ? (
                      <Button type="button" size="sm" variant="ghost" disabled>
                        {m.newFieldSchema}
                      </Button>
                    ) : (
                      <Link href={newSchemaHref}>
                        <Button type="button" size="sm" variant="ghost">
                          {m.newFieldSchema}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Field>
            </div>

            {mode === "edit" && referenceObject ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{m.recordsTitle}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">{m.recordsDescription}</p>
                  </div>
                  <Button type="button" size="sm" onClick={openCreateRecord} disabled={!form.values.fieldSchemaId}>
                    {m.addRecord}
                  </Button>
                </div>
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                  {isLoadingRecords ? (
                    <p className="p-3 text-sm text-[var(--color-text-secondary)]">{messages.commonUi.loadingTitle}</p>
                  ) : records.length === 0 ? (
                    <p className="p-3 text-sm text-[var(--color-text-secondary)]">{m.noRecords}</p>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)]">
                      {records.map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => openEditRecord(record)}
                          className="grid w-full gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] md:grid-cols-[minmax(0,1fr)_minmax(120px,0.4fr)_72px]"
                        >
                          <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{record.title}</span>
                          <span className="truncate font-mono text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{record.key}</span>
                          <span className="text-right text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">{record.sortOrder ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </AdminDetailShell>

      <DetailPanelShell
        open={recordPanelOpen}
        ariaLabel={m.recordPanelTitle}
        eyebrow={referenceObject?.name ?? m.title}
        color={referenceObject?.color}
        title={<h2 className="truncate text-lg font-semibold text-[var(--color-text-primary)]">{isCreatingRecord ? m.createRecord : selectedRecord?.title ?? m.editRecord}</h2>}
        actions={(
          <>
            {!isCreatingRecord && (
              <Button type="button" size="sm" variant="ghost" onClick={() => deleteRecordMutation.mutate()} disabled={deleteRecordMutation.isPending}>
                {messages.common.delete}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => (isCreatingRecord ? createRecordMutation.mutate() : updateRecordMutation.mutate())}
              disabled={!recordCanSave || createRecordMutation.isPending || updateRecordMutation.isPending}
            >
              {messages.common.save}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={closeRecordPanel}>
              {messages.common.cancel}
            </Button>
          </>
        )}
        onClose={closeRecordPanel}
        main={(
          <SectionCard title={m.recordFieldsTitle}>
            {recordFields.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{m.noRecordFields}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recordFields.map((field) => renderRecordField(field))}
              </div>
            )}
          </SectionCard>
        )}
        side={(
          <SectionCard title={m.recordSettingsTitle}>
            <div className="space-y-2">
              <DetailFieldRow label={m.recordTitle} required>
                <Input value={recordTitle} onChange={(event) => setRecordTitle(event.target.value)} placeholder={m.recordTitlePlaceholder} />
              </DetailFieldRow>
              <DetailFieldRow label={m.recordKey} required>
                <Input value={recordKey} onChange={(event) => setRecordKey(normalizeKey(event.target.value))} placeholder={m.recordKeyPlaceholder} />
              </DetailFieldRow>
              <DetailFieldRow label={m.parentRecord}>
                <select
                  value={recordParentId}
                  onChange={(event) => setRecordParentId(event.target.value)}
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
                >
                  <option value="">{m.noParentRecord}</option>
                  {records.filter((record) => record.id !== activeRecordId).map((record) => (
                    <option key={record.id} value={record.id}>{record.title}</option>
                  ))}
                </select>
              </DetailFieldRow>
              <DetailFieldRow label={m.sortOrder}>
                <Input type="number" value={recordSortOrder} onChange={(event) => setRecordSortOrder(event.target.value)} />
              </DetailFieldRow>
            </div>
          </SectionCard>
        )}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
