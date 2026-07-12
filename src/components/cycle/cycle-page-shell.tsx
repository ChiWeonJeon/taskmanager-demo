"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CycleDetailPanel } from "@/components/cycle/cycle-detail-panel";
import type { IssueTypeField, IssueTypeOption, WorkItemFieldValue } from "@/components/task/types";
import {
  getReferenceObjectKey,
  isMultiReferenceField,
  isSingleReferenceField,
  useObjectReferenceOptions,
} from "@/components/task/use-object-reference-options";
import { canonicalizeReferenceValue, canonicalizeReferenceValues, getReferenceOptionAliases } from "@/lib/reference-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/shared/locale-provider";
import { PlusIcon, TrashTabIcon } from "@/components/task/task-icons";
import { isFieldValuePresent, parseFieldOptions, parseStoredFieldValue } from "@/lib/field-schema";
import { useToast } from "@/lib/toast";

interface CycleStatus {
  id: string;
  name: string;
  color: string;
}

interface CycleProject {
  id: string;
  key: string;
  name: string;
}

interface CycleGroup {
  id: string;
  slug: string;
  name: string;
}

interface CycleUser {
  id: string;
  name: string;
  shortName: string | null;
  email: string;
  avatarUpdatedAt: string | null;
}

interface CycleRecord {
  id: string;
  issueTypeId: string;
  issueType: IssueTypeOption;
  name: string;
  scope: "GROUP" | "PROJECT" | string;
  projectId: string | null;
  groupId: string | null;
  startDate: string | null;
  endDate: string | null;
  inheritByDefault: boolean;
  inherited: boolean;
  status: CycleStatus | null;
  owner: CycleUser | null;
  creator: CycleUser | null;
  updatedBy: CycleUser | null;
  project: CycleProject | null;
  contextProject?: CycleProject | null;
  group: CycleGroup | null;
  comments: { id: string; body: string; createdAt: string; author: { id: string; name: string; shortName: string | null; email: string; avatarUpdatedAt: string | null } | null }[];
  histories: { id: string; field: string; before: string | null; after: string | null; createdAt: string; actor: { id: string; name: string; shortName: string | null; email: string; avatarUpdatedAt: string | null } | null }[];
  watchers: { id: string; source: string; createdAt: string; user: { id: string; name: string; shortName: string | null; email: string; avatarUpdatedAt: string | null }; addedBy: { id: string; name: string; shortName: string | null; email: string; avatarUpdatedAt: string | null } | null }[];
  fieldValues: WorkItemFieldValue[];
  createdAt: string;
  updatedAt: string;
}

interface InheritanceRow {
  project: CycleProject;
  enabled: boolean;
}

interface CyclesResponse {
  cycles: CycleRecord[];
  inheritance?: Record<string, InheritanceRow[]>;
}

interface Props {
  endpoint: string;
  queryKey: readonly unknown[];
  mode: "project" | "group" | "global";
  referenceProjectId?: string | null;
  referenceGroupId?: string | null;
}

type DynamicFieldValue = string | string[] | null;

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

function getCycleIssueTypeFields(issueType: IssueTypeOption | null | undefined) {
  return (
    issueType?.fieldSchema?.fields.map((entry) => ({
      ...entry.field,
      defaultValue: entry.defaultValue ?? entry.field.defaultValue ?? null,
      isRequired: Boolean(entry.isRequired || entry.field.isRequired),
    })) ?? []
  ) as IssueTypeField[];
}

function getSchemaDefaultFieldValues(fields: IssueTypeField[]) {
  const next: Record<string, DynamicFieldValue> = {};
  for (const field of fields) {
    if (!field.defaultValue) continue;
    const parsed = parseStoredFieldValue(field, field.defaultValue) as DynamicFieldValue;
    if (parsed === null) continue;
    if (Array.isArray(parsed) && parsed.length === 0) continue;
    next[field.id] = parsed;
  }
  return next;
}

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function CyclePageShell({ endpoint, queryKey, mode, referenceProjectId, referenceGroupId }: Props) {
  const { messages } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const copy = messages.cyclesPage;
  const selectedCycleId = searchParams.get("cycle");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [inheritByDefault, setInheritByDefault] = useState(true);
  const [fieldValues, setFieldValues] = useState<Record<string, DynamicFieldValue>>({});
  const [createScope, setCreateScope] = useState<"PROJECT" | "GROUP">(mode === "group" ? "GROUP" : "PROJECT");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");

  const query = useQuery<CyclesResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(copy.createError);
      return response.json();
    },
  });
  const canCreate = true;
  const globalProjectsQuery = useQuery<CycleProject[]>({
    queryKey: ["cycle-create-projects"],
    enabled: mode === "global",
    queryFn: async () => {
      const response = await fetch("/api/projects?memberId=me");
      if (!response.ok) throw new Error(copy.createError);
      return response.json();
    },
  });
  const globalGroupsQuery = useQuery<CycleGroup[]>({
    queryKey: ["cycle-create-groups"],
    enabled: mode === "global",
    queryFn: async () => {
      const response = await fetch("/api/project-groups?memberId=me");
      if (!response.ok) throw new Error(copy.createError);
      return response.json();
    },
  });
  const issueTypesQuery = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types", "cycle"],
    enabled: canCreate,
    queryFn: async () => {
      const response = await fetch("/api/issue-types?category=CYCLE");
      if (!response.ok) throw new Error(copy.createError);
      return response.json();
    },
  });
  const selectedIssueType = issueTypesQuery.data?.[0] ?? null;
  const customFields = useMemo(
    () => getCycleIssueTypeFields(selectedIssueType).filter((field) => !field.isSystem),
    [selectedIssueType],
  );
  const defaultFieldValues = useMemo(() => getSchemaDefaultFieldValues(customFields), [customFields]);
  const effectiveCreateScope = mode === "group" ? "GROUP" : mode === "project" ? "PROJECT" : createScope;
  const selectedTargetProjectId =
    mode === "project"
      ? referenceProjectId ?? ""
      : targetProjectId || globalProjectsQuery.data?.[0]?.id || "";
  const selectedTargetGroupId =
    mode === "group"
      ? referenceGroupId ?? ""
      : targetGroupId || globalGroupsQuery.data?.[0]?.slug || globalGroupsQuery.data?.[0]?.id || "";
  const createEndpoint = effectiveCreateScope === "GROUP"
    ? selectedTargetGroupId
      ? `/api/project-groups/${encodeURIComponent(selectedTargetGroupId)}/cycles`
      : null
    : selectedTargetProjectId
      ? `/api/projects/${encodeURIComponent(selectedTargetProjectId)}/cycles`
      : null;
  const { data: referenceOptionsByTarget = {} } = useObjectReferenceOptions(
    customFields,
    effectiveCreateScope === "PROJECT" ? selectedTargetProjectId : null,
    effectiveCreateScope === "GROUP" ? selectedTargetGroupId : null,
  );
  const normalizeReferenceFieldValue = (field: IssueTypeField, value: DynamicFieldValue): DynamicFieldValue => {
    const referenceObjectKey = getReferenceObjectKey(field);
    const options = referenceObjectKey ? referenceOptionsByTarget[referenceObjectKey] ?? [] : [];
    if (isSingleReferenceField(field) && typeof value === "string") {
      return canonicalizeReferenceValue(options, value) || null;
    }
    if (isMultiReferenceField(field) && Array.isArray(value)) {
      return canonicalizeReferenceValues(options, value);
    }
    return value;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createEndpoint) throw new Error(copy.targetRequired);
      const payloadFieldValues: Record<string, DynamicFieldValue> = {};
      for (const field of customFields) {
        const value = normalizeReferenceFieldValue(field, fieldValues[field.id] ?? null);
        if (isFieldValuePresent(value ?? undefined)) {
          payloadFieldValues[field.id] = value;
        }
      }

      const response = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startDate: startDate || null,
          endDate: endDate || null,
          inheritByDefault,
          issueTypeId: selectedIssueType?.id,
          fieldValues: payloadFieldValues,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || copy.createError);
      }
      return response.json();
    },
    onSuccess: () => {
      setName("");
      setStartDate("");
      setEndDate("");
      setFieldValues({});
      if (mode === "global") {
        setCreateScope("PROJECT");
      }
      queryClient.invalidateQueries({ queryKey });
      toast(copy.createSuccess, { type: "success" });
    },
    onError: (error: Error) => toast(error.message || copy.createError, { type: "error", sticky: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (cycleId: string) => {
      const response = await fetch(`${endpoint}/${cycleId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(copy.deleteError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast(copy.deleteSuccess, { type: "info" });
    },
    onError: () => toast(copy.deleteError, { type: "error", sticky: true }),
  });

  const title = mode === "global" ? copy.allTitle : mode === "group" ? copy.groupTitle : copy.projectTitle;
  const cycles = query.data?.cycles ?? [];
  const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId) ?? null;
  const selectedInheritanceRows = selectedCycle ? (query.data?.inheritance?.[selectedCycle.id] ?? []) : [];
  const interactionProjectId =
    mode === "project"
      ? null
      : selectedCycle?.contextProject?.id
        ?? selectedCycle?.projectId
        ?? selectedCycle?.project?.id
        ?? selectedInheritanceRows.find((row) => row.enabled)?.project.id
        ?? selectedInheritanceRows[0]?.project.id
        ?? null;
  const selectedGroupSlugOrId = selectedCycle?.group?.slug ?? selectedCycle?.groupId ?? referenceGroupId ?? null;
  const groupCycleEndpoint = selectedCycle && selectedGroupSlugOrId
    ? `/api/project-groups/${encodeURIComponent(selectedGroupSlugOrId)}/cycles/${encodeURIComponent(selectedCycle.id)}`
    : null;
  const detailEndpoint = selectedCycle
    ? mode === "global"
      ? interactionProjectId
        ? `/api/projects/${encodeURIComponent(interactionProjectId)}/cycles/${encodeURIComponent(selectedCycle.id)}`
        : groupCycleEndpoint
      : `${endpoint}/${encodeURIComponent(selectedCycle.id)}`
    : null;
  const interactionEndpoint = selectedCycle
    ? mode === "global"
      ? interactionProjectId
        ? `/api/projects/${encodeURIComponent(interactionProjectId)}/cycles/${encodeURIComponent(selectedCycle.id)}`
        : groupCycleEndpoint
      : mode === "group"
        ? `${endpoint}/${encodeURIComponent(selectedCycle.id)}`
      : `${endpoint}/${encodeURIComponent(selectedCycle.id)}`
    : null;
  const editableProjectId = selectedCycle?.projectId ?? selectedCycle?.project?.id ?? selectedCycle?.contextProject?.id ?? null;
  const editEndpoint = selectedCycle && !selectedCycle.inherited
    ? mode === "global"
      ? selectedCycle.scope === "GROUP"
        ? groupCycleEndpoint
        : editableProjectId
          ? `/api/projects/${encodeURIComponent(editableProjectId)}/cycles/${encodeURIComponent(selectedCycle.id)}`
          : null
      : `${endpoint}/${encodeURIComponent(selectedCycle.id)}`
    : null;
  const inheritanceEndpoint = selectedCycle?.scope === "GROUP" && groupCycleEndpoint
    ? `${groupCycleEndpoint}/inheritance`
    : null;
  const projectInheritanceEndpoint = selectedCycle?.inherited && interactionProjectId
    ? `/api/projects/${encodeURIComponent(interactionProjectId)}/cycles/${encodeURIComponent(selectedCycle.id)}/inheritance`
    : null;
  const isCreateTargetLoading =
    mode === "global" && (
      effectiveCreateScope === "GROUP"
        ? globalGroupsQuery.isLoading
        : globalProjectsQuery.isLoading
    );

  const setSelectedCycleId = (cycleId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cycleId) params.set("cycle", cycleId);
    else params.delete("cycle");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const missingCustomField = customFields.find((field) => (
      field.isRequired && !isFieldValuePresent((fieldValues[field.id] ?? defaultFieldValues[field.id]) ?? undefined)
    ));
    if (missingCustomField) {
      toast(interpolate(messages.createTaskModal.requiredField, { field: missingCustomField.name }), {
        type: "error",
        sticky: true,
      });
      return;
    }
    createMutation.mutate();
  };

  const updateFieldValue = (fieldId: string, value: DynamicFieldValue) => {
    setFieldValues((current) => ({ ...current, [fieldId]: value }));
  };

  const fieldLabelClass = "block text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]";

  function renderCustomField(field: IssueTypeField) {
    const value = fieldValues[field.id] ?? defaultFieldValues[field.id];
    const label = (
      <label className={fieldLabelClass} htmlFor={`cycle-field-${field.id}`}>
        {field.name}
        {field.isRequired && <span className="ml-1 text-[var(--color-danger)]">*</span>}
      </label>
    );
    const options = parseFieldOptions(field.options);
    const referenceObjectKey = getReferenceObjectKey(field);
    const referenceOptions = referenceOptionsByTarget[referenceObjectKey] ?? [];

    if (field.type === "DATE") {
      return (
        <div key={field.id} className="min-w-0 space-y-1">
          {label}
          <Input
            id={`cycle-field-${field.id}`}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateFieldValue(field.id, event.target.value)}
          />
        </div>
      );
    }

    if (field.type === "SELECT" || isSingleReferenceField(field)) {
      const selectOptions = isSingleReferenceField(field) ? referenceOptions : options;
      return (
        <div key={field.id} className="min-w-0 space-y-1">
          {label}
          <select
            id={`cycle-field-${field.id}`}
            value={isSingleReferenceField(field) ? canonicalizeReferenceValue(selectOptions, typeof value === "string" ? value : "") : typeof value === "string" ? value : ""}
            onChange={(event) => updateFieldValue(field.id, isSingleReferenceField(field) ? canonicalizeReferenceValue(selectOptions, event.target.value) || null : event.target.value || null)}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
          >
            <option value="">{messages.common.select}</option>
            {selectOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === "MULTI_SELECT" || isMultiReferenceField(field)) {
      const fieldOptions = isMultiReferenceField(field) ? referenceOptions : options;
      const selected = new Set(isMultiReferenceField(field) && Array.isArray(value)
        ? canonicalizeReferenceValues(fieldOptions, value)
        : Array.isArray(value)
          ? value
          : []);
      const toggle = (optionValue: string) => {
        const next = new Set(selected);
        const option = fieldOptions.find((entry) => entry.value === optionValue);
        const aliases = option ? getReferenceOptionAliases(option) : [optionValue];
        if (aliases.some((alias) => next.has(alias))) {
          for (const alias of aliases) next.delete(alias);
        } else {
          next.add(optionValue);
        }
        updateFieldValue(field.id, Array.from(next));
      };
      return (
        <div key={field.id} className="min-w-0 space-y-1">
          {label}
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2">
            {fieldOptions.map((option) => (
              <label key={option.value} className="flex min-w-0 items-center gap-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={selected.has(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div key={field.id} className="min-w-0 space-y-1">
        {label}
        <Input
          id={`cycle-field-${field.id}`}
          type={field.type === "NUMBER" ? "number" : field.type === "URL" ? "url" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateFieldValue(field.id, event.target.value)}
          placeholder={interpolate(messages.createTaskModal.enterField, { field: field.name })}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h2 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
          {copy.description}
        </p>
      </div>

      {canCreate && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3"
        >
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_minmax(9rem,12rem)_auto] md:items-end">
            <label className="min-w-0 text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
              {copy.name}
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.namePlaceholder}
                className="mt-1"
              />
            </label>
            <label className="text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
              {copy.startDate}
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1" />
            </label>
            <label className="text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
              {copy.endDate}
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1" />
            </label>
            <Button type="submit" disabled={!name.trim() || !createEndpoint || createMutation.isPending || issueTypesQuery.isLoading || isCreateTargetLoading}>
              <PlusIcon className="h-4 w-4" />
              <span>{createMutation.isPending ? copy.creating : copy.create}</span>
            </Button>
          </div>
          {mode === "global" && (
            <div className="grid gap-2 border-t border-[var(--color-border)] pt-3 md:grid-cols-2">
              <label className="min-w-0 text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                {copy.scope}
                <select
                  value={createScope}
                  onChange={(event) => setCreateScope(event.target.value === "GROUP" ? "GROUP" : "PROJECT")}
                  className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
                >
                  <option value="PROJECT">{copy.projectCycle}</option>
                  <option value="GROUP">{copy.groupCycle}</option>
                </select>
              </label>
              {effectiveCreateScope === "GROUP" ? (
                <label className="min-w-0 text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  {copy.targetGroup}
                  <select
                    value={selectedTargetGroupId}
                    onChange={(event) => setTargetGroupId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
                  >
                    <option value="">{copy.selectGroup}</option>
                    {(globalGroupsQuery.data ?? []).map((group) => (
                      <option key={group.id} value={group.slug || group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="min-w-0 text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  {copy.targetProject}
                  <select
                    value={selectedTargetProjectId}
                    onChange={(event) => setTargetProjectId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]"
                  >
                    <option value="">{copy.selectProject}</option>
                    {(globalProjectsQuery.data ?? []).map((project) => (
                      <option key={project.id} value={project.id}>[{project.key}] {project.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {(effectiveCreateScope === "GROUP" || customFields.length > 0) && (
            <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
              {effectiveCreateScope === "GROUP" && (
                <label className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={inheritByDefault}
                    onChange={(event) => setInheritByDefault(event.target.checked)}
                  />
                  <span>{copy.inheritByDefault}</span>
                </label>
              )}
              {customFields.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[length:var(--text-xs)] font-semibold text-[var(--color-text-secondary)]">
                    {messages.taskWorkspace.customFields}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {customFields.map((field) => renderCustomField(field))}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        {query.isLoading ? (
          <div className="h-32 animate-pulse bg-[var(--color-bg-tertiary)]" />
        ) : (query.data?.cycles.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-[length:var(--text-sm)] text-[var(--color-text-tertiary)]">
            {copy.empty}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {query.data!.cycles.map((cycle) => {
              const inherited = cycle.inherited;
              return (
                <div key={cycle.id} className="space-y-3 p-3">
                  <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedCycleId(cycle.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cycle.status?.color ?? "var(--color-text-tertiary)" }}
                        />
                        <h3 className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
                          {cycle.name}
                        </h3>
                        <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                          {inherited ? copy.inherited : cycle.scope === "GROUP" ? copy.groupCycle : copy.projectCycle}
                        </span>
                      </div>
                      <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                        {[toDateInput(cycle.startDate), toDateInput(cycle.endDate)].filter(Boolean).join(" - ") || cycle.status?.name}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        href={`/all-tasks?cycle=${encodeURIComponent(cycle.id)}`}
                        className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[length:var(--text-xs)] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
                      >
                        {copy.viewTasks}
                      </Link>
                      {mode !== "global" && !inherited && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => deleteMutation.mutate(cycle.id)}
                          disabled={deleteMutation.isPending}
                          aria-label={copy.delete}
                          title={copy.delete}
                        >
                          <TrashTabIcon className="h-4 w-4" />
                          <span>{copy.delete}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
      <CycleDetailPanel
        open={Boolean(selectedCycle)}
        initialCycle={selectedCycle}
        detailEndpoint={detailEndpoint}
        interactionEndpoint={interactionEndpoint}
        editEndpoint={editEndpoint}
        initialInheritanceRows={selectedInheritanceRows}
        inheritanceEndpoint={inheritanceEndpoint}
        projectInheritanceEndpoint={projectInheritanceEndpoint}
        projectInheritanceProject={selectedCycle?.contextProject ?? selectedCycle?.project ?? null}
        referenceGroupId={referenceGroupId}
        onClose={() => setSelectedCycleId(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey })}
      />
    </div>
  );
}
