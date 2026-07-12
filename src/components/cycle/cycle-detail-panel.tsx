"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { DateDisplay } from "@/components/shared/date-display";
import {
  DetailFieldRow,
  DetailPanelShell,
  InfoCard,
  SectionCard,
} from "@/components/shared/detail-panel-shell";
import { useI18n } from "@/components/shared/locale-provider";
import { Button } from "@/components/ui/button";
import { RichTextRenderer } from "@/components/rich-text/rich-text-renderer";
import { UserName } from "@/components/user/user-name";
import type { IssueTypeField, IssueTypeOption, WorkItemFieldValue } from "@/components/task/types";
import { isFieldValuePresent, parseFieldOptions, parseStoredFieldValue } from "@/lib/field-schema";
import { useToast } from "@/lib/toast";
import {
  getReferenceObjectKey,
  isMultiReferenceField,
  isSingleReferenceField,
  useObjectReferenceOptions,
} from "@/components/task/use-object-reference-options";
import { canonicalizeReferenceValue, canonicalizeReferenceValues, findReferenceOption, getReferenceOptionAliases } from "@/lib/reference-options";

interface DetailUser {
  id: string;
  name: string;
  shortName: string | null;
  email: string;
  avatarUpdatedAt: string | null;
}

interface CycleDetail {
  id: string;
  issueTypeId: string;
  issueType: IssueTypeOption;
  name: string;
  scope: string;
  projectId: string | null;
  groupId: string | null;
  startDate: string | null;
  endDate: string | null;
  inheritByDefault: boolean;
  inherited: boolean;
  status: { id: string; name: string; color: string } | null;
  owner: DetailUser | null;
  creator: DetailUser | null;
  updatedBy: DetailUser | null;
  project: { id: string; key: string; name: string } | null;
  contextProject?: { id: string; key: string; name: string } | null;
  group: { id: string; slug: string; name: string } | null;
  comments: { id: string; body: string; createdAt: string; author: DetailUser | null }[];
  histories: { id: string; field: string; before: string | null; after: string | null; createdAt: string; actor: DetailUser | null }[];
  watchers: { id: string; source: string; createdAt: string; user: DetailUser; addedBy: DetailUser | null }[];
  fieldValues: WorkItemFieldValue[];
  createdAt: string;
  updatedAt: string;
}

interface InheritanceRow {
  project: { id: string; key: string; name: string };
  enabled: boolean;
}

type DynamicFieldValue = string | string[] | null;

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
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

interface CycleDetailPanelProps {
  open: boolean;
  initialCycle: CycleDetail | null;
  detailEndpoint: string | null;
  interactionEndpoint: string | null;
  editEndpoint: string | null;
  initialInheritanceRows?: InheritanceRow[];
  inheritanceEndpoint?: string | null;
  projectInheritanceEndpoint?: string | null;
  projectInheritanceProject?: { id: string; key: string; name: string } | null;
  referenceGroupId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function CycleDetailPanel({
  open,
  initialCycle,
  detailEndpoint,
  interactionEndpoint,
  editEndpoint,
  initialInheritanceRows = [],
  inheritanceEndpoint,
  projectInheritanceEndpoint,
  projectInheritanceProject,
  referenceGroupId,
  onClose,
  onChanged,
}: CycleDetailPanelProps) {
  const { messages } = useI18n();
  const t = messages.cycleDetail;
  const { toast } = useToast();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [statusId, setStatusId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [inheritByDefault, setInheritByDefault] = useState(true);
  const [detailFieldValues, setDetailFieldValues] = useState<Record<string, DynamicFieldValue>>({});

  const detailQuery = useQuery({
    queryKey: ["cycle-detail", detailEndpoint],
    enabled: open && Boolean(detailEndpoint),
    queryFn: async () => {
      const response = await fetch(detailEndpoint!);
      if (!response.ok) throw new Error(t.loadFailed);
      return (await response.json()) as { cycle: CycleDetail; inheritance?: InheritanceRow[] };
    },
  });

  const canEditCycle = Boolean(editEndpoint);
  const usersQuery = useQuery<DetailUser[]>({
    queryKey: ["cycle-detail-users"],
    enabled: open && canEditCycle,
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error(t.loadFailed);
      return response.json();
    },
  });

  useEffect(() => {
    if (!open) setComment("");
  }, [open]);

  const cycle = detailQuery.data?.cycle ?? initialCycle;
  const currentUserId = session?.user?.id ?? "";
  const isWatching = Boolean(cycle?.watchers.some((watcher) => watcher.user.id === currentUserId));
  const canInteract = Boolean(interactionEndpoint);
  const customFields = getCycleIssueTypeFields(cycle?.issueType).filter((field) => !field.isSystem);
  const inheritanceRows = detailQuery.data?.inheritance ?? initialInheritanceRows;
  const referenceProjectId = cycle?.projectId ?? cycle?.project?.id ?? projectInheritanceProject?.id ?? "";
  const cycleReferenceGroupId = referenceGroupId ?? cycle?.groupId ?? cycle?.group?.slug ?? "";
  const { data: referenceOptionsByTarget = {} } = useObjectReferenceOptions(
    customFields,
    referenceProjectId,
    cycleReferenceGroupId,
  );

  useEffect(() => {
    if (!cycle) return;
    setName(cycle.name);
    setStatusId(cycle.status?.id ?? "");
    setStartDate(toDateInput(cycle.startDate));
    setEndDate(toDateInput(cycle.endDate));
    setOwnerId(cycle.owner?.id ?? "");
    setInheritByDefault(cycle.inheritByDefault);
    const nextFieldValues: Record<string, DynamicFieldValue> = {};
    for (const fieldValue of cycle.fieldValues) {
      nextFieldValues[fieldValue.fieldId] = parseStoredFieldValue(fieldValue.field, fieldValue.value) as DynamicFieldValue;
    }
    setDetailFieldValues(nextFieldValues);
  }, [cycle]);

  if (!open || typeof document === "undefined") return null;

  const refetch = () => {
    detailQuery.refetch();
    onChanged();
  };

  async function toggleWatch() {
    if (!interactionEndpoint) return;
    setBusy(true);
    try {
      await fetch(
        isWatching ? `${interactionEndpoint}/watchers/me` : `${interactionEndpoint}/watchers`,
        { method: isWatching ? "DELETE" : "POST" },
      );
      refetch();
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    if (!interactionEndpoint || !comment.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`${interactionEndpoint}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim() }),
      });
      if (response.ok) {
        setComment("");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!interactionEndpoint) return;
    setBusy(true);
    try {
      await fetch(`${interactionEndpoint}/comments/${commentId}`, { method: "DELETE" });
      refetch();
    } finally {
      setBusy(false);
    }
  }

  function updateDetailFieldValue(fieldId: string, value: DynamicFieldValue) {
    setDetailFieldValues((current) => ({ ...current, [fieldId]: value }));
  }

  function normalizeReferenceFieldValue(field: IssueTypeField, value: DynamicFieldValue): DynamicFieldValue {
    const referenceObjectKey = getReferenceObjectKey(field);
    const options = referenceObjectKey ? referenceOptionsByTarget[referenceObjectKey] ?? [] : [];
    if (isSingleReferenceField(field) && typeof value === "string") {
      return canonicalizeReferenceValue(options, value) || null;
    }
    if (isMultiReferenceField(field) && Array.isArray(value)) {
      return canonicalizeReferenceValues(options, value);
    }
    return value;
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editEndpoint || !cycle) return;

    if (!name.trim()) {
      toast(messages.errors.nameRequired, { type: "error", sticky: true });
      return;
    }

    const fieldValues = {} as Record<string, string | string[]>;
    const clearFieldIds = [] as string[];

    for (const field of customFields) {
      const value = normalizeReferenceFieldValue(field, detailFieldValues[field.id] ?? null);
      if (field.isRequired && !isFieldValuePresent(value ?? undefined)) {
        toast(messages.createTaskModal.requiredField.replace("{field}", field.name), {
          type: "error",
          sticky: true,
        });
        return;
      }
      if (Array.isArray(value)) {
        const values = value.filter((item) => item.trim().length > 0);
        if (values.length > 0) fieldValues[field.id] = values;
        else clearFieldIds.push(field.id);
        continue;
      }

      const stringValue = typeof value === "string" ? value.trim() : "";
      if (isFieldValuePresent(stringValue)) fieldValues[field.id] = stringValue;
      else clearFieldIds.push(field.id);
    }

    setBusy(true);
    try {
      const response = await fetch(editEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          statusId: statusId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          ownerId: ownerId || null,
          inheritByDefault,
          fieldValues,
          clearFieldIds,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || t.saveFailed);
      }
      toast(t.saveSuccess, { type: "success" });
      refetch();
    } catch (error) {
      toast(error instanceof Error ? error.message : t.saveFailed, { type: "error", sticky: true });
    } finally {
      setBusy(false);
    }
  }

  async function updateGroupInheritance(projectId: string, enabled: boolean) {
    if (!inheritanceEndpoint) return;
    setBusy(true);
    try {
      const response = await fetch(inheritanceEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, enabled }),
      });
      if (!response.ok) throw new Error(t.inheritanceSaveFailed);
      toast(t.inheritanceSaved, { type: "success" });
      refetch();
    } catch (error) {
      toast(error instanceof Error ? error.message : t.inheritanceSaveFailed, { type: "error", sticky: true });
    } finally {
      setBusy(false);
    }
  }

  async function updateProjectInheritance(enabled: boolean) {
    if (!projectInheritanceEndpoint) return;
    setBusy(true);
    try {
      const response = await fetch(projectInheritanceEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error(t.inheritanceSaveFailed);
      toast(t.inheritanceSaved, { type: "success" });
      refetch();
    } catch (error) {
      toast(error instanceof Error ? error.message : t.inheritanceSaveFailed, { type: "error", sticky: true });
    } finally {
      setBusy(false);
    }
  }

  function historyText(entry: CycleDetail["histories"][number]) {
    if (entry.field === "created") return t.historyCreated;
    if (entry.field === "comment") return t.historyComment;
    if (entry.field === "deleted") return t.historyDeleted;
    return t.fieldChanged.replace("{field}", entry.field);
  }

  function formatCustomFieldValue(field: IssueTypeField, rawValue: string) {
    const parsed = parseStoredFieldValue(field, rawValue);
    const staticOptions = parseFieldOptions(field.options);
    const referenceObjectKey = getReferenceObjectKey(field);
    const referenceOptions = referenceOptionsByTarget[referenceObjectKey] ?? [];
    const options = isSingleReferenceField(field) || isMultiReferenceField(field)
      ? referenceOptions
      : staticOptions;
    const optionLabel = (value: string) => findReferenceOption(options, value)?.label ?? value;

    if (Array.isArray(parsed)) return parsed.map(optionLabel).join(", ");
    if (typeof parsed === "string") {
      return field.type === "SELECT" || isSingleReferenceField(field)
        ? optionLabel(parsed)
        : parsed;
    }
    return "";
  }

  function renderCustomFieldInput(field: IssueTypeField) {
    const value = detailFieldValues[field.id] ?? null;
    const staticOptions = parseFieldOptions(field.options);
    const referenceObjectKey = getReferenceObjectKey(field);
    const referenceOptions = referenceOptionsByTarget[referenceObjectKey] ?? [];
    const options = isSingleReferenceField(field) || isMultiReferenceField(field)
      ? referenceOptions
      : staticOptions;
    const inputId = `cycle-detail-field-${field.id}`;

    if (field.type === "DATE") {
      return (
        <DetailFieldRow key={field.id} label={field.name} align="start">
          <input
            id={inputId}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateDetailFieldValue(field.id, event.target.value || null)}
            className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
          />
        </DetailFieldRow>
      );
    }

    if (field.type === "SELECT" || isSingleReferenceField(field)) {
      return (
        <DetailFieldRow key={field.id} label={field.name} align="start">
          <select
            id={inputId}
            value={isSingleReferenceField(field) ? canonicalizeReferenceValue(options, typeof value === "string" ? value : "") : typeof value === "string" ? value : ""}
            onChange={(event) => updateDetailFieldValue(field.id, isSingleReferenceField(field) ? canonicalizeReferenceValue(options, event.target.value) || null : event.target.value || null)}
            className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
          >
            <option value="">{messages.common.select}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </DetailFieldRow>
      );
    }

    if (field.type === "MULTI_SELECT" || isMultiReferenceField(field)) {
      const selected = new Set(isMultiReferenceField(field) && Array.isArray(value)
        ? canonicalizeReferenceValues(options, value)
        : Array.isArray(value)
          ? value
          : []);
      return (
        <DetailFieldRow key={field.id} label={field.name} align="start">
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2">
            {options.map((option) => (
              <label key={option.value} className="flex min-w-0 items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={selected.has(option.value)}
                  onChange={() => {
                    const next = new Set(selected);
                    const aliases = getReferenceOptionAliases(option);
                    if (aliases.some((alias) => next.has(alias))) {
                      for (const alias of aliases) next.delete(alias);
                    } else {
                      next.add(option.value);
                    }
                    updateDetailFieldValue(field.id, Array.from(next));
                  }}
                  className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
        </DetailFieldRow>
      );
    }

    return (
      <DetailFieldRow key={field.id} label={field.name} align="start">
        <input
          id={inputId}
          type={field.type === "NUMBER" ? "number" : field.type === "URL" ? "url" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateDetailFieldValue(field.id, event.target.value || null)}
          className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
        />
      </DetailFieldRow>
    );
  }

  const infoCards = cycle ? (
    <>
      <InfoCard
        label={t.creator}
        primary={cycle.creator ? <UserName user={cycle.creator} withAvatar /> : t.unknown}
        secondary={cycle.creator?.email}
      />
      <InfoCard
        label={t.owner}
        primary={cycle.owner ? <UserName user={cycle.owner} withAvatar /> : t.unassigned}
        secondary={cycle.owner?.email}
      />
      <InfoCard
        label={t.createdAt}
        primary={<DateDisplay date={cycle.createdAt} format="compact" />}
      />
      <InfoCard
        label={t.updatedAt}
        primary={<DateDisplay date={cycle.updatedAt} format="compact" />}
      />
    </>
  ) : null;

  const mainColumn = !cycle ? (
    <SectionCard title={t.details}>
      <p className="text-sm text-[var(--color-text-secondary)]">{t.loading}</p>
    </SectionCard>
  ) : (
    <>
      <SectionCard title={t.comments}>
        <div className="space-y-3">
          {canInteract && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t.commentPlaceholder}
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-sm"
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={submitComment} disabled={busy || !comment.trim()}>
                  {t.commentSubmit}
                </Button>
              </div>
            </div>
          )}

          {cycle.comments.length === 0 ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
              {t.commentEmpty}
            </p>
          ) : (
            <div className="space-y-2">
              {cycle.comments.map((entry) => (
                <div key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                    <UserName user={entry.author} withAvatar avatarSize="xs" labelClassName="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]" />
                    <div className="flex items-center gap-2">
                      <DateDisplay date={entry.createdAt} format="full" />
                      {canInteract && entry.author?.id === currentUserId && (
                        <button
                          type="button"
                          onClick={() => deleteComment(entry.id)}
                          className="transition-colors hover:text-[var(--color-danger)]"
                        >
                          {t.commentDelete}
                        </button>
                      )}
                    </div>
                  </div>
                  <RichTextRenderer content={entry.body} />
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t.history}>
        {cycle.histories.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
            {t.historyEmpty}
          </p>
        ) : (
          <div className="space-y-2">
            {cycle.histories.map((entry) => (
              <div key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                  <UserName user={entry.actor} withAvatar avatarSize="xs" labelClassName="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]" />
                  <DateDisplay date={entry.createdAt} format="full" />
                </div>
                <p className="mt-2 break-words text-[length:var(--text-sm)] leading-6 text-[var(--color-text-primary)]">
                  {historyText(entry)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );

  const statusOptions = cycle?.issueType.statusSchema?.statuses.map((entry) => entry.status) ?? [];
  const ownerOptions = usersQuery.data ?? (cycle?.owner ? [cycle.owner] : []);
  const sideColumn = cycle ? (
    <>
      <SectionCard title={t.details}>
        {canEditCycle ? (
          <form className="space-y-2" onSubmit={submitDetails}>
            <DetailFieldRow label={t.name} required>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
              />
            </DetailFieldRow>
            <DetailFieldRow label={t.status}>
              <select
                value={statusId}
                onChange={(event) => setStatusId(event.target.value)}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
              >
                <option value="">{t.none}</option>
                {statusOptions.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </DetailFieldRow>
            <DetailFieldRow label={t.scope}>
              <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                {cycle.inherited ? t.inherited : cycle.scope === "GROUP" ? t.groupScope : t.projectScope}
              </span>
            </DetailFieldRow>
            {cycle.project && (
              <DetailFieldRow label={t.project}>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  [{cycle.project.key}] {cycle.project.name}
                </span>
              </DetailFieldRow>
            )}
            {cycle.contextProject && cycle.inherited && (
              <DetailFieldRow label={t.contextProject}>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  [{cycle.contextProject.key}] {cycle.contextProject.name}
                </span>
              </DetailFieldRow>
            )}
            {cycle.group && (
              <DetailFieldRow label={t.group}>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  {cycle.group.name}
                </span>
              </DetailFieldRow>
            )}
            <DetailFieldRow label={t.startDate}>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
              />
            </DetailFieldRow>
            <DetailFieldRow label={t.endDate}>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
              />
            </DetailFieldRow>
            <DetailFieldRow label={t.owner}>
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
              >
                <option value="">{t.unassigned}</option>
                {ownerOptions.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </DetailFieldRow>
            {cycle.scope === "GROUP" && (
              <DetailFieldRow label={t.inheritByDefault}>
                <label className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={inheritByDefault}
                    onChange={(event) => setInheritByDefault(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                  />
                  <span>{inheritByDefault ? t.enabled : t.disabled}</span>
                </label>
              </DetailFieldRow>
            )}
            {customFields.length > 0 && (
              <div className="space-y-2 border-t border-[var(--color-border)] pt-2">
                <p className="text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">
                  {t.customFields}
                </p>
                {customFields.map((field) => renderCustomFieldInput(field))}
              </div>
            )}
            <div className="flex justify-end border-t border-[var(--color-border)] pt-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? t.saving : t.saveDetails}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <DetailFieldRow label={t.status}>
              <span className="inline-flex items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: cycle.status?.color ?? "var(--color-text-tertiary)" }}
                />
                {cycle.status?.name ?? t.unknown}
              </span>
            </DetailFieldRow>
            <DetailFieldRow label={t.scope}>
              <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                {cycle.inherited ? t.inherited : cycle.scope === "GROUP" ? t.groupScope : t.projectScope}
              </span>
            </DetailFieldRow>
            {cycle.project && (
              <DetailFieldRow label={t.project}>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  [{cycle.project.key}] {cycle.project.name}
                </span>
              </DetailFieldRow>
            )}
            {cycle.contextProject && cycle.inherited && (
              <DetailFieldRow label={t.contextProject}>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  [{cycle.contextProject.key}] {cycle.contextProject.name}
                </span>
              </DetailFieldRow>
            )}
            {cycle.group && (
              <DetailFieldRow label={t.group}>
                <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                  {cycle.group.name}
                </span>
              </DetailFieldRow>
            )}
            <DetailFieldRow label={t.startDate}>
              <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                {cycle.startDate ? <DateDisplay date={cycle.startDate} format="date" /> : t.none}
              </span>
            </DetailFieldRow>
            <DetailFieldRow label={t.endDate}>
              <span className="text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
                {cycle.endDate ? <DateDisplay date={cycle.endDate} format="date" /> : t.none}
              </span>
            </DetailFieldRow>
            {cycle.fieldValues.map((fieldValue) => (
              <DetailFieldRow key={fieldValue.fieldId} label={fieldValue.field.name} align="start">
                <span className="break-words text-[length:var(--text-xs)] leading-5 text-[var(--color-text-primary)]">
                  {formatCustomFieldValue(fieldValue.field, fieldValue.value)}
                </span>
              </DetailFieldRow>
            ))}
          </div>
        )}
      </SectionCard>

      {(inheritanceRows.length > 0 || projectInheritanceEndpoint) && (
        <SectionCard title={t.inheritance}>
          {projectInheritanceEndpoint ? (
            <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-2 py-1.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)]">
              <span className="min-w-0 truncate">
                {projectInheritanceProject
                  ? `[${projectInheritanceProject.key}] ${projectInheritanceProject.name}`
                  : t.currentProject}
              </span>
              <input
                type="checkbox"
                checked
                disabled={busy}
                onChange={(event) => updateProjectInheritance(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--color-accent)]"
              />
            </label>
          ) : (
            <div className="space-y-1.5">
              {inheritanceRows.map((row) => (
                <label
                  key={row.project.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-2 py-1.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)]"
                >
                  <span className="min-w-0 truncate">[{row.project.key}] {row.project.name}</span>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    disabled={busy || !inheritanceEndpoint}
                    onChange={(event) => updateGroupInheritance(row.project.id, event.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                  />
                </label>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title={t.watchers}>
        {cycle.watchers.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">{t.watchersEmpty}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {cycle.watchers.map((watcher) => (
              <li
                key={watcher.id}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-primary)]"
                title={watcher.source}
              >
                <UserName user={watcher.user} withAvatar avatarSize="xs" truncate={false} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  ) : (
    <SectionCard title={t.details}>
      <p className="text-sm text-[var(--color-text-secondary)]">{t.loading}</p>
    </SectionCard>
  );

  return (
    <DetailPanelShell
      open={open}
      ariaLabel={t.ariaLabel}
      color={cycle?.status?.color ?? "#6366f1"}
      eyebrow={cycle?.group?.name ?? cycle?.project?.name ?? t.eyebrow}
      title={(
        <h2 className="truncate text-[length:var(--text-base)] font-semibold leading-5 text-[var(--color-text-primary)]">
          {cycle?.name ?? t.loading}
        </h2>
      )}
      actions={(
        <>
          {cycle && (
            <Link
              href={`/all-tasks?cycle=${encodeURIComponent(cycle.id)}`}
              className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-[length:var(--text-xs)] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            >
              {t.viewTasks}
            </Link>
          )}
          {cycle && canInteract && (
            <Button variant="ghost" size="sm" onClick={toggleWatch} disabled={busy}>
              {isWatching ? t.unwatch : t.watch}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={messages.common.close}>
            {messages.common.close}
          </Button>
        </>
      )}
      infoCards={infoCards}
      main={mainColumn}
      side={sideColumn}
      onClose={onClose}
    />
  );
}
