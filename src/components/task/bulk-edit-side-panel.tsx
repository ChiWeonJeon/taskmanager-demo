"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/shared/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { ChevronDownIcon, CloseIcon, WarningIcon } from "@/components/task/task-icons";
import type { StatusOption, WorkItemWithRelations } from "@/components/task/types";
import {
  BULK_WORK_ITEM_ACTION_LIMIT,
  getCommonStatusOptions,
  isMultiValueField,
  isOptionField,
  toEditableFieldValue,
  type BulkFieldValue,
} from "@/components/task/use-bulk-work-item-actions";
import type { TransitionsByIssueType } from "@/lib/task-status";
import {
  formatCustomFieldText,
  getTaskCustomFieldValue,
  isFieldInTaskSchema,
  type WorkspaceField,
} from "@/lib/workspace-field-model";
import { cn } from "@/lib/utils";

export type BulkPanelTab = "field" | "status";

export const taskToolSidePanelClass =
  "fixed inset-y-0 right-0 z-[70] flex h-full min-h-0 w-[min(24rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-y border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-lg)] md:relative md:inset-auto md:z-auto md:ml-3 md:h-auto md:w-[360px] md:shrink-0 md:self-stretch md:shadow-none";

const taskToolOverlaySidePanelClass =
  "fixed inset-y-0 right-0 z-[70] flex h-full min-h-0 w-[min(24rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-y border-l border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-lg)]";

const panelSelectTriggerClassName =
  "h-9 w-full justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/15";

const panelSelectChevronClassName = "h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]";

interface BulkEditSidePanelProps {
  selectedTasks: WorkItemWithRelations[];
  statuses: StatusOption[];
  allowedStatusIdsByIssueType?: Record<string, string[]>;
  transitionsByIssueType?: TransitionsByIssueType;
  workspaceFields: WorkspaceField[];
  pending: boolean;
  initialTab: BulkPanelTab;
  overlay?: boolean;
  onClose: () => void;
  onApplyFieldChange: (fieldId: string, value: BulkFieldValue) => void;
  onApplyStatusChange: (statusId: string) => void;
}

export function BulkEditSidePanel({
  selectedTasks,
  statuses,
  allowedStatusIdsByIssueType,
  transitionsByIssueType,
  workspaceFields,
  pending,
  initialTab,
  overlay = false,
  onClose,
  onApplyFieldChange,
  onApplyStatusChange,
}: BulkEditSidePanelProps) {
  const { messages } = useI18n();
  const t = messages.taskWorkspace.bulkBar;
  const [activeTab, setActiveTab] = useState<BulkPanelTab>(initialTab);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [fieldValue, setFieldValue] = useState<string | string[]>("");
  const [clearValue, setClearValue] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState("");

  const editableFields = useMemo(
    () => workspaceFields.filter((field) => !field.isSystem),
    [workspaceFields],
  );
  const selectedField = editableFields.find((field) => field.id === selectedFieldId) ?? editableFields[0] ?? null;
  const normalizedFieldValue = selectedField ? toEditableFieldValue(selectedField, fieldValue) : fieldValue;
  const selectedCountLabel = t.selectedCount.replace("{count}", String(selectedTasks.length));
  const tooManySelected = selectedTasks.length > BULK_WORK_ITEM_ACTION_LIMIT;
  const tooManyLabel = t.tooManySelected.replace("{max}", String(BULK_WORK_ITEM_ACTION_LIMIT));

  const notInSchemaCount = selectedField
    ? selectedTasks.filter((task) => !isFieldInTaskSchema(selectedField, task)).length
    : 0;

  const previewTask = selectedField
    ? selectedTasks.find((task) => isFieldInTaskSchema(selectedField, task)) ?? selectedTasks[0] ?? null
    : null;
  const previewBefore = selectedField && previewTask && isFieldInTaskSchema(selectedField, previewTask)
    ? formatCustomFieldText(selectedField, getTaskCustomFieldValue(previewTask, selectedField)) ?? messages.common.none
    : messages.common.none;
  const previewAfter = selectedField
    ? clearValue
      ? messages.common.none
      : formatCustomFieldText(selectedField, normalizedFieldValue) ?? messages.common.none
    : messages.common.none;

  const commonStatusOptions = useMemo(
    () => getCommonStatusOptions(selectedTasks, statuses, allowedStatusIdsByIssueType, transitionsByIssueType),
    [allowedStatusIdsByIssueType, selectedTasks, statuses, transitionsByIssueType],
  );
  const fieldOptions = editableFields.map((field) => ({ value: field.id, label: field.name }));
  const fieldValueOptions = selectedField?.options.map((option) => ({
    value: option.value,
    label: option.label,
    color: option.color,
  })) ?? [];
  const statusOptions = commonStatusOptions.map((status) => ({
    value: status.id,
    label: status.name,
    color: status.color,
  }));

  const submitFieldChange = () => {
    if (!selectedField || tooManySelected) return;
    onApplyFieldChange(selectedField.id, clearValue ? null : normalizedFieldValue);
  };

  const submitStatusChange = () => {
    if (!selectedStatusId || tooManySelected) return;
    onApplyStatusChange(selectedStatusId);
  };

  const canApplyField = Boolean(selectedField) && !pending && !tooManySelected && (clearValue || Boolean(fieldValue));
  const canApplyStatus = Boolean(selectedStatusId) && !pending && !tooManySelected;

  return (
    <aside
      className={overlay ? taskToolOverlaySidePanelClass : taskToolSidePanelClass}
      aria-label={t.panelTitle}
    >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
              {t.panelTitle}
            </h2>
            <p className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
              {selectedCountLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={messages.common.close}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <div
            className="inline-flex h-9 w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
            role="group"
            aria-label={t.panelTitle}
          >
            {(["status", "field"] as BulkPanelTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "min-w-0 flex-1 rounded-[var(--radius-xs)] px-2 text-[length:var(--text-xs)] transition-colors",
                  activeTab === tab
                    ? "bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-[var(--shadow-xs)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                )}
              >
                <span className="truncate">{tab === "status" ? t.statusChange : t.fieldChange}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tooManySelected && (
            <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-warning)]">
              <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{tooManyLabel}</span>
            </div>
          )}

          {activeTab === "status" ? (
            statusOptions.length === 0 ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-4 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                {t.noStatusOptions}
              </div>
            ) : (
              <Combobox
                options={statusOptions}
                value={selectedStatusId}
                onChange={setSelectedStatusId}
                className="w-full"
                placeholder={t.statusPlaceholder}
                triggerClassName={panelSelectTriggerClassName}
                renderTrigger={(option) => (
                  <>
                    {option ? (
                      <Badge color={option.color ?? undefined} className="min-w-0 px-2 py-0.5 text-[length:var(--text-2xs)]">
                        <span className="truncate">{option.label}</span>
                      </Badge>
                    ) : (
                      <span className="truncate text-[var(--color-text-tertiary)]">{t.statusPlaceholder}</span>
                    )}
                    <ChevronDownIcon className={panelSelectChevronClassName} />
                  </>
                )}
              />
            )
          ) : editableFields.length === 0 ? (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-4 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
              {t.noEditableFields}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                  {t.fieldLabel}
                </label>
                <Combobox
                  options={fieldOptions}
                  value={selectedField?.id ?? ""}
                  onChange={(value) => {
                    const nextField = editableFields.find((field) => field.id === value) ?? null;
                    setSelectedFieldId(value);
                    setFieldValue(nextField && isMultiValueField(nextField) ? [] : "");
                    setClearValue(false);
                  }}
                  className="w-full"
                  triggerClassName={panelSelectTriggerClassName}
                  renderTrigger={(option) => (
                    <>
                      <span className="truncate">{option?.label ?? t.fieldLabel}</span>
                      <ChevronDownIcon className={panelSelectChevronClassName} />
                    </>
                  )}
                />
              </div>

              {selectedField && (
                <div>
                  <label className="mb-1 block text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
                    {t.valueLabel}
                  </label>
                  {isMultiValueField(selectedField) ? (
                    <MultiCombobox
                      options={fieldValueOptions}
                      values={Array.isArray(normalizedFieldValue) ? normalizedFieldValue : []}
                      onChange={setFieldValue}
                      className="w-full"
                      disabled={clearValue}
                      placeholder={messages.taskWorkspace.multiSelectPlaceholder}
                      triggerClassName={panelSelectTriggerClassName}
                      renderTrigger={(selected) => {
                        const label = selected.length === 0
                          ? messages.taskWorkspace.multiSelectPlaceholder
                          : selected.length === 1
                            ? selected[0]!.label
                            : messages.taskWorkspace.multiSelectSummary
                                .replace("{first}", selected[0]!.label)
                                .replace("{rest}", String(selected.length - 1));
                        return (
                          <>
                            <span className={cn("truncate", selected.length > 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]")}>
                              {label}
                            </span>
                            <ChevronDownIcon className={panelSelectChevronClassName} />
                          </>
                        );
                      }}
                    />
                  ) : isOptionField(selectedField) ? (
                    <Combobox
                      options={fieldValueOptions}
                      value={typeof normalizedFieldValue === "string" ? normalizedFieldValue : ""}
                      onChange={setFieldValue}
                      className="w-full"
                      placeholder={messages.common.select}
                      triggerClassName={cn(panelSelectTriggerClassName, clearValue && "pointer-events-none opacity-60")}
                      renderTrigger={(option) => (
                        <>
                          <span className={cn("truncate", option ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]")}>
                            {option?.label ?? messages.common.select}
                          </span>
                          <ChevronDownIcon className={panelSelectChevronClassName} />
                        </>
                      )}
                    />
                  ) : (
                    <Input
                      type={selectedField.type === "DATE" ? "date" : selectedField.type === "NUMBER" ? "number" : "text"}
                      value={typeof normalizedFieldValue === "string" ? normalizedFieldValue : ""}
                      onChange={(event) => setFieldValue(event.target.value)}
                      disabled={clearValue}
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-[length:var(--text-sm)] text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={clearValue}
                  onChange={(event) => setClearValue(event.target.checked)}
                  className="h-4 w-4 rounded accent-[var(--color-accent)]"
                />
                <span>{t.clearValue}</span>
              </label>

              {notInSchemaCount > 0 && (
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-warning-light)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-warning)]">
                  <WarningIcon className="h-4 w-4 shrink-0" />
                  <span>{t.notInSchemaWarning.replace("{count}", String(notInSchemaCount))}</span>
                </div>
              )}

              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3 text-[length:var(--text-xs)]">
                <p className="mb-2 font-semibold text-[var(--color-text-secondary)]">{t.preview}</p>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
                  <span className="text-[var(--color-text-tertiary)]">{t.previewBefore}</span>
                  <span className="truncate text-[var(--color-text-primary)]">{previewBefore}</span>
                  <span className="text-[var(--color-text-tertiary)]">{t.previewAfter}</span>
                  <span className="truncate text-[var(--color-text-primary)]">{previewAfter}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={activeTab === "status" ? submitStatusChange : submitFieldChange}
            disabled={activeTab === "status" ? !canApplyStatus : !canApplyField}
          >
            {pending ? t.applying : t.apply}
          </Button>
        </div>
    </aside>
  );
}
