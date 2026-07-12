"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { UserName } from "@/components/user/user-name";
import { InlineTextEdit } from "@/components/ui/inline-text-edit";
import { useI18n } from "@/components/shared/locale-provider";
import { DateDisplay } from "@/components/shared/date-display";
import { RichTextRenderer } from "@/components/rich-text/rich-text-renderer";
import type { ResolvedMentionRefs } from "@/lib/mention/resolve-refs";
import { TaskWatchersButton } from "@/components/task/task-watchers-button";
import {
  DetailFieldRow,
  DetailPanelShell,
  InfoCard,
  SectionCard,
} from "@/components/shared/detail-panel-shell";

// Lazy-load the rich text editor so the task workspace bundle doesn't pay the
// tiptap cost until a user opens the detail panel and edits description/comments.
const RichTextEditor = dynamic(
  () => import("@/components/rich-text/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false }
);
import { TaskEmptyState } from "@/components/task/task-empty-state";
import { TaskInlineDateEditor } from "@/components/task/task-inline-date-editor";
import { ArrowUpIcon, CommentBubbleIcon } from "@/components/task/task-icons";
import { TaskList } from "@/components/task/task-list";
import {
  IssueTypeField,
  IssueTypeOption,
  ProjectOption,
  ResolvedProjectConfig,
  StatusOption,
  WorkItemFieldValue,
  WorkItemUpdate,
  WorkItemWithRelations,
} from "@/components/task/types";
import {
  EDITABLE_SYSTEM_FIELD_KEY_SET,
  ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET,
  LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET,
  getFieldValueMap,
  getIssueTypeSchemaFields,
  parseFieldOptions,
  parseStoredFieldValue,
} from "@/lib/field-schema";
import { toDateInputValue } from "@/lib/date";
import { isStatusTransitionAllowed } from "@/lib/task-status";
import {
  getReferenceObjectKey,
  isMultiReferenceField,
  isSingleReferenceField,
  useObjectReferenceOptions,
} from "@/components/task/use-object-reference-options";
import { canonicalizeReferenceValue, canonicalizeReferenceValues, findReferenceOption, getReferenceOptionAliases } from "@/lib/reference-options";

interface TaskDetailPanelProps {
  task: WorkItemWithRelations | null;
  statuses: StatusOption[];
  allTasks?: WorkItemWithRelations[];
  issueTypes: IssueTypeOption[];
  projects: ProjectOption[];
  scrollRequest?: { taskId: string; target: "comments"; requestId: number } | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: WorkItemUpdate) => void;
  onRefresh?: () => void;
  onSelect?: (task: WorkItemWithRelations) => void;
  onEditInModal?: (task: WorkItemWithRelations, targetIssueTypeId?: string) => void;
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

type SortOrder = "desc" | "asc";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ProjectMember {
  user: UserOption;
}

interface DetailBodyEditorProps {
  value: string;
  placeholder: string;
  projectKey: string;
  onSave: (value: string) => void;
  mentionRefs?: ResolvedMentionRefs | null;
}

function DetailBodyEditor({ value, placeholder, projectKey, onSave, mentionRefs }: DetailBodyEditorProps) {
  const { messages } = useI18n();
  const editorMessages = messages.richTextEditor;
  const editorLabels = editorMessages.toolbar;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleSave() {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <RichTextEditor
          projectKey={projectKey}
          value={draft}
          onChange={setDraft}
          variant="full"
          placeholder={placeholder}
          toolbarLabels={editorLabels}
          mentionEnabled={Boolean(projectKey)}
          minHeight="180px"
          autoFocus
          onSubmit={handleSave}
        />
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            {editorMessages.cancel}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {editorMessages.save}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="flex min-h-[180px] w-full items-start rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-primary)]"
      title="Edit description"
    >
      <div className="w-full">
        {value ? (
          <RichTextRenderer
            content={value}
            className="text-[length:var(--text-sm)] leading-6 text-[var(--color-text-primary)]"
            mentionRefs={mentionRefs}
          />
        ) : (
          <span className="text-[length:var(--text-sm)] text-[var(--color-text-tertiary)]">{placeholder}</span>
        )}
      </div>
    </button>
  );
}

function compareByCreatedAt(
  left: { createdAt: string },
  right: { createdAt: string },
  sortOrder: SortOrder
) {
  if (left.createdAt === right.createdAt) return 0;
  if (sortOrder === "desc") {
    return left.createdAt > right.createdAt ? -1 : 1;
  }
  return left.createdAt < right.createdAt ? -1 : 1;
}

function getHistoryFieldLabel(messages: ReturnType<typeof useI18n>["messages"], field: string) {
  switch (field) {
    case "title":
      return messages.createTaskModal.taskTitle;
    case "description":
      return messages.taskWorkspace.filterFields.description;
    case "project":
      return messages.createTaskModal.project;
    case "status":
      return messages.createTaskModal.status;
    case "assignee":
      return messages.createTaskModal.assignee;
    case "parent":
      return messages.createTaskModal.parentTask;
    case "issueType":
      return messages.createTaskModal.issueType;
    case "startDate":
      return messages.taskCalendar.startDate;
    case "dueDate":
      return messages.taskCalendar.dueDate;
    case "created":
      return "Created";
    default:
      return field;
  }
}

function getSchemaFieldLabel(messages: ReturnType<typeof useI18n>["messages"], field: IssueTypeField) {
  switch (field.key) {
    case "project":
      return messages.createTaskModal.project;
    case "status":
      return messages.createTaskModal.status;
    case "assignee":
      return messages.createTaskModal.assignee;
    case "parent":
      return messages.createTaskModal.parentTask;
    case "description":
      return messages.taskWorkspace.filterFields.description;
    case "start_date":
      return messages.taskCalendar.startDate;
    case "due_date":
      return messages.taskCalendar.dueDate;
    case "priority":
      return messages.createTaskModal.priority;
    default:
      return field.name;
  }
}

function formatProjectLabel(project: ProjectOption) {
  return `[${project.key}] ${project.name}`;
}
export function TaskDetailPanel({
  task,
  allTasks = [],
  statuses,
  issueTypes,
  projects,
  scrollRequest,
  onClose,
  onDelete,
  onUpdate,
  onRefresh,
  onSelect,
  onEditInModal,
}: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const { messages } = useI18n();
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [commentBody, setCommentBody] = useState("");
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [panelCollapsedIds, setPanelCollapsedIds] = useState(new Set<string>());
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const { data: taskDetail } = useQuery<WorkItemWithRelations | null>({
    queryKey: ["work-item-detail", task?.id],
    enabled: Boolean(task?.id),
    queryFn: async () => {
      if (!task?.id) return null;
      const response = await fetch(`/api/work-items/${task.id}`);
      if (!response.ok) throw new Error("Failed to fetch work item detail");
      return response.json();
    },
    staleTime: 10_000,
  });

  const activeTask = taskDetail ?? task;
  const projectIdForQueries = activeTask?.projectId ?? task?.projectId ?? null;
  // 일감 GET 응답에 포함된 server-resolved mention metadata. 댓글/설명 RichTextRenderer 가
  // user 칩(아바타+축약네임)을 그릴 때 사용한다.
  const activeTaskMentionRefs =
    (activeTask as { mentionRefs?: ResolvedMentionRefs } | null)?.mentionRefs ?? null;

  const { data: projectConfig } = useQuery<ResolvedProjectConfig>({
    queryKey: ["project-config", projectIdForQueries],
    enabled: Boolean(projectIdForQueries),
    queryFn: async () => {
      if (!projectIdForQueries) throw new Error("Project is required");
      const response = await fetch(`/api/projects/${projectIdForQueries}/config`);
      if (!response.ok) throw new Error("Failed to fetch project configuration");
      return response.json();
    },
    staleTime: 30_000,
  });

  const { data: projectMembers = [] } = useQuery<UserOption[]>({
    queryKey: ["project-members", projectIdForQueries],
    enabled: Boolean(projectIdForQueries),
    queryFn: async () => {
      if (!projectIdForQueries) return [];
      const response = await fetch(`/api/projects/${projectIdForQueries}/members`);
      if (!response.ok) throw new Error("Failed to fetch project members");
      const members = (await response.json()) as ProjectMember[];
      return members.map((member) => member.user);
    },
  });

  const { data: parentCandidates = [] } = useQuery<{ id: string; issueKey: string; title: string }[]>({
    queryKey: ["work-items", "parent-candidates", projectIdForQueries],
    enabled: Boolean(projectIdForQueries),
    queryFn: async () => {
      if (!projectIdForQueries) return [];
      const response = await fetch(`/api/work-items?projectId=${projectIdForQueries}&fields=id,issueKey,title`);
      if (!response.ok) throw new Error("Failed to fetch project work items");
      return response.json();
    },
    staleTime: 30_000,
  });

  const needsIssueTypeSchemas = issueTypes.some((issueType) => !issueType.fieldSchema || !issueType.statusSchema);
  const { data: issueTypesWithSchemas = [] } = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types"],
    enabled: Boolean(task?.id) && needsIssueTypeSchemas,
    queryFn: async () => {
      const response = await fetch("/api/issue-types");
      if (!response.ok) throw new Error("Failed to fetch issue types");
      return response.json();
    },
    staleTime: 30_000,
  });

  const globalIssueTypes = issueTypesWithSchemas.length > 0 ? issueTypesWithSchemas : issueTypes;
  const resolvedIssueTypes = useMemo(() => {
    const scopedIssueTypes = projectIdForQueries
      ? projectConfig?.enabledIssueTypes ?? []
      : globalIssueTypes;
    const next = [...scopedIssueTypes];

    if (activeTask?.issueTypeId && !next.some((issueType) => issueType.id === activeTask.issueTypeId)) {
      const currentIssueType = globalIssueTypes.find((issueType) => issueType.id === activeTask.issueTypeId);
      if (currentIssueType) next.push(currentIssueType);
    }

    return next;
  }, [activeTask?.issueTypeId, globalIssueTypes, projectConfig?.enabledIssueTypes, projectIdForQueries]);

  const prevTaskRef = useRef<{ id: string; updatedAt: string } | null>(null);

  useEffect(() => {
    if (!task?.id) {
      prevTaskRef.current = null;
      return;
    }

    const prev = prevTaskRef.current;
    prevTaskRef.current = { id: task.id, updatedAt: task.updatedAt };
    if (prev?.id === task.id && prev.updatedAt !== task.updatedAt) {
      queryClient.invalidateQueries({ queryKey: ["work-item-detail", task.id] });
    }
  }, [queryClient, task?.id, task?.updatedAt]);

  useEffect(() => {
    setCommentBody("");
    setIsCreatingComment(false);
    setPanelCollapsedIds(new Set());
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [task?.id]);

  useEffect(() => {
    if (!scrollRequest || !activeTask || scrollRequest.taskId !== activeTask.id || scrollRequest.target !== "comments") {
      return;
    }

    let innerRaf = 0;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        commentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    return () => {
      window.cancelAnimationFrame(outerRaf);
      window.cancelAnimationFrame(innerRaf);
    };
  }, [activeTask, scrollRequest]);

  const selectedIssueType = useMemo(
    () => resolvedIssueTypes.find((issueType) => issueType.id === activeTask?.issueTypeId) ?? null,
    [activeTask?.issueTypeId, resolvedIssueTypes]
  );

  const statusOptions = useMemo(
    () => statuses.map((status) => ({ value: status.id, label: status.name, color: status.color })),
    [statuses]
  );
  const availableStatusOptions = useMemo(() => {
    const schemaStatuses = selectedIssueType?.statusSchema?.statuses;
    if (!selectedIssueType || !schemaStatuses) return statusOptions;

    const transitions = selectedIssueType.statusSchema?.transitions ?? [];
    const transitionMap = { [selectedIssueType.id]: transitions };
    const currentStatusId = activeTask?.statusId;

    return schemaStatuses
      .filter((entry) =>
        entry.status.id === currentStatusId
        || isStatusTransitionAllowed(selectedIssueType.id, currentStatusId, entry.status.id, transitionMap)
      )
      .map((entry) => ({
        value: entry.status.id,
        label: entry.status.name,
        color: entry.status.color,
      }));
  }, [selectedIssueType, statusOptions, activeTask?.statusId]);
  const typeOptions = useMemo(
    () => resolvedIssueTypes.map((issueType) => ({ value: issueType.id, label: issueType.name, color: issueType.color })),
    [resolvedIssueTypes]
  );
  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.id, label: formatProjectLabel(project) })),
    [projects]
  );
  const userOptions = useMemo(
    () => projectMembers.map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })),
    [projectMembers]
  );
  const parentOptions = useMemo(
    () => [
      { value: "", label: messages.common.none },
      ...parentCandidates
        .filter((candidate) => candidate.id !== activeTask?.id)
        .map((candidate) => ({ value: candidate.id, label: `[${candidate.issueKey}] ${candidate.title}` })),
    ],
    [activeTask?.id, messages.common.none, parentCandidates]
  );

  const parentTask = activeTask?.parent
    ? allTasks.find((item) => item.id === activeTask.parent?.id) ?? null
    : null;

  const editableSchemaFields = useMemo(
    () =>
      getIssueTypeSchemaFields(selectedIssueType).filter((field) => (
        field.key !== "title"
        && field.key !== "description"
        && !ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key)
        && !LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key)
      )),
    [selectedIssueType]
  );
  const customSchemaFields = useMemo(
    () => editableSchemaFields.filter((field) => !EDITABLE_SYSTEM_FIELD_KEY_SET.has(field.key)),
    [editableSchemaFields],
  );
  const { data: referenceOptionsByTarget = {} } = useObjectReferenceOptions(customSchemaFields, projectIdForQueries);

  const customFieldValueMap = useMemo(
    () => getFieldValueMap(activeTask?.fieldValues),
    [activeTask?.fieldValues]
  );

  // Optimistically patch the detail query cache so inline edits in the panel
  // (priority, status, assignee, etc.) render immediately instead of waiting
  // for the refetch that the parent mutation triggers. Without this the panel
  // reads `taskDetail` from its own query, which is stale until onSuccess
  // invalidation completes.
  const handleUpdate = (id: string, data: WorkItemUpdate) => {
    queryClient.setQueryData<WorkItemWithRelations | null>(
      ["work-item-detail", id],
      (old) => {
        if (!old) return old;
        const updated: WorkItemWithRelations = { ...old };
        if (data.title !== undefined) updated.title = data.title;
        if (data.description !== undefined) updated.description = data.description;
        if (data.startDate !== undefined) updated.startDate = data.startDate;
        if (data.dueDate !== undefined) updated.dueDate = data.dueDate;
        if (data.statusId) {
          updated.statusId = data.statusId;
          const status = statuses.find((s) => s.id === data.statusId);
          if (status) {
            updated.status = { id: status.id, name: status.name, color: status.color, category: status.category };
          }
        }
        if (data.issueTypeId) {
          updated.issueTypeId = data.issueTypeId;
          const issueType = resolvedIssueTypes.find((t) => t.id === data.issueTypeId);
          if (issueType) {
              updated.issueType = {
                id: issueType.id,
                key: issueType.key,
                name: issueType.name,
                icon: issueType.icon,
                color: issueType.color,
              fieldSchemaId: issueType.fieldSchemaId,
              statusSchemaId: issueType.statusSchemaId,
            };
          }
        }
        if (data.projectId !== undefined) {
          updated.projectId = data.projectId;
          if (data.projectId) {
            const project = projects.find((p) => p.id === data.projectId);
            if (project) {
              updated.project = { id: project.id, name: project.name, key: project.key };
            }
          } else {
            updated.project = null;
          }
        }
        if (data.assigneeId !== undefined) {
          const member = projectMembers.find((u) => u.id === data.assigneeId);
          if (member) {
            updated.assignee = { id: member.id, name: member.name, email: member.email };
          }
        }
        if (data.parentId !== undefined) {
          updated.parentId = data.parentId;
          if (!data.parentId) updated.parent = null;
        }
        if (data.fieldValues) {
          const existing = [...(updated.fieldValues ?? [])];
          for (const [fieldId, value] of Object.entries(data.fieldValues)) {
            if (value == null) continue;
            const idx = existing.findIndex((fv) => fv.fieldId === fieldId);
            const stringValue = JSON.stringify(value);
            if (idx >= 0) {
              existing[idx] = { ...existing[idx], value: stringValue };
            } else {
              existing.push({ fieldId, value: stringValue, field: {} as WorkItemFieldValue["field"] });
            }
          }
          updated.fieldValues = existing;
        }
        if (data.clearFieldIds) {
          const clearSet = new Set(data.clearFieldIds);
          updated.fieldValues = (updated.fieldValues ?? []).filter((fv) => !clearSet.has(fv.fieldId));
        }
        return updated;
      }
    );
    onUpdate?.(id, data);
  };
  const { panelDepthById, panelHasChildrenIds, panelDisplayTasks } = useMemo(() => {
    const empty = {
      panelDepthById: new Map<string, number>(),
      panelHasChildrenIds: new Set<string>(),
      panelDisplayTasks: [] as WorkItemWithRelations[],
    };
    if (!activeTask) return empty;

    const childMap = new Map<string, string[]>();
    const taskById = new Map(allTasks.map((item) => [item.id, item]));

    for (const item of allTasks) {
      if (!item.parentId) continue;
      const next = childMap.get(item.parentId) ?? [];
      next.push(item.id);
      childMap.set(item.parentId, next);
    }

    const panelDepthById = new Map<string, number>();
    const panelHasChildrenIds = new Set<string>();

    function computeMeta(id: string, depth: number) {
      for (const childId of childMap.get(id) ?? []) {
        panelDepthById.set(childId, depth);
        if ((childMap.get(childId) ?? []).length > 0) {
          panelHasChildrenIds.add(childId);
        }
        computeMeta(childId, depth + 1);
      }
    }

    function flatten(id: string, output: WorkItemWithRelations[]) {
      for (const childId of childMap.get(id) ?? []) {
        const child = taskById.get(childId);
        if (child) {
          output.push(child);
        }
        if (!panelCollapsedIds.has(childId)) {
          flatten(childId, output);
        }
      }
    }

    computeMeta(activeTask.id, 1);
    const panelDisplayTasks: WorkItemWithRelations[] = [];
    flatten(activeTask.id, panelDisplayTasks);
    return { panelDepthById, panelHasChildrenIds, panelDisplayTasks };
  }, [activeTask, allTasks, panelCollapsedIds]);

  const comments = useMemo(
    () => [...(activeTask?.comments ?? [])].sort((left, right) => compareByCreatedAt(left, right, sortOrder)),
    [activeTask?.comments, sortOrder]
  );

  const histories = useMemo(
    () =>
      [...(activeTask?.histories ?? [])]
        .map((history) => ({
          ...history,
          text: `${getHistoryFieldLabel(messages, history.field)}: ${history.before ?? messages.common.none} -> ${history.after ?? messages.common.none}`,
        }))
        .sort((left, right) => compareByCreatedAt(left, right, sortOrder)),
    [activeTask?.histories, messages, sortOrder]
  );

  const latestModifierEntry = useMemo(
    () => activeTask?.histories?.find((history) => history.field !== "created") ?? null,
    [activeTask?.histories]
  );
  const latestModifier = latestModifierEntry?.actor ?? activeTask?.creator ?? null;

  const detailPanelMessages = messages.taskDetailPanel;
  const infoLabels = {
    creator: detailPanelMessages.creator,
    modifier: detailPanelMessages.modifier,
    createdAt: detailPanelMessages.createdAt,
    updatedAt: detailPanelMessages.updatedAt,
    unknown: detailPanelMessages.unknown,
    noHistory: detailPanelMessages.noHistory,
  };

  const sortOrderLabel = sortOrder === "desc"
    ? detailPanelMessages.sortNewest
    : detailPanelMessages.sortOldest;

  const fieldControlClassName = "flex h-7 w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 text-[length:var(--text-xs)] leading-4 text-[var(--color-text-primary)]";
  const titleFieldClassName = "mx-0 block w-full rounded-[var(--radius-md)] border border-transparent px-1.5 py-1 text-[length:var(--text-base)] font-semibold leading-5 text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]";
  const titleFieldInputClassName = "h-8 rounded-[var(--radius-md)] px-1.5 py-1 text-[length:var(--text-base)] font-semibold leading-5";

  const renderTextTrigger = (label: string) => (
    <span className={fieldControlClassName}>
      <span className="truncate">{label}</span>
    </span>
  );

  const renderBadgeTrigger = (content: ReactNode) => (
    <span className={fieldControlClassName}>{content}</span>
  );

  const renderDateTrigger = (value: string | null, emptyLabel: string) => (
    <span className={fieldControlClassName}>
      {value ? <DateDisplay date={value} format="compact" dateOnly /> : <span>{emptyLabel}</span>}
    </span>
  );

  const saveCustomField = (field: IssueTypeField, value: string | string[] | null) => {
    if (!activeTask) return;
    const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());

    if (!hasValue) {
      handleUpdate(activeTask.id, { clearFieldIds: [field.id] });
      return;
    }

    handleUpdate(activeTask.id, { fieldValues: { [field.id]: value } });
  };
  const renderSchemaField = (field: IssueTypeField) => {
    if (!activeTask) return null;

    const label = getSchemaFieldLabel(messages, field);

    if (field.key === "project") {
      return (
        <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
          <Combobox
            className="w-full"
            options={projectOptions}
            value={activeTask.projectId ?? ""}
            onChange={(projectId) => handleUpdate(activeTask.id, { projectId: projectId || null })}
            renderTrigger={(option) => renderTextTrigger(option?.label ?? messages.common.select)}
          />
        </DetailFieldRow>
      );
    }

    if (field.key === "status") {
      return (
        <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
          <Combobox
            className="w-full"
            options={availableStatusOptions}
            value={activeTask.statusId}
            onChange={(statusId) => handleUpdate(activeTask.id, { statusId })}
            renderTrigger={(option) => renderBadgeTrigger(
              <Badge color={option?.color ?? activeTask.status.color} className="px-2 py-0.5 text-[length:var(--text-2xs)]">
                {option?.label ?? activeTask.status.name}
              </Badge>
            )}
          />
        </DetailFieldRow>
      );
    }

    if (field.key === "assignee") {
      return (
        <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
          <Combobox
            className="w-full"
            options={userOptions}
            value={activeTask.assignee?.id ?? ""}
            onChange={(assigneeId) => {
              if (assigneeId) {
                handleUpdate(activeTask.id, { assigneeId });
              }
            }}
            renderTrigger={(option) => renderTextTrigger(option?.label ?? activeTask.assignee?.name ?? messages.common.none)}
          />
        </DetailFieldRow>
      );
    }

    if (field.key === "parent") {
      return (
        <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
          <Combobox
            className="w-full"
            options={parentOptions}
            value={activeTask.parentId ?? ""}
            onChange={(parentId) => handleUpdate(activeTask.id, { parentId: parentId || null })}
            renderTrigger={(option) => renderTextTrigger(
              option?.label ?? (
                activeTask.parent
                  ? `[${activeTask.parent.issueKey}] ${activeTask.parent.title}`
                  : messages.common.none
              )
            )}
          />
        </DetailFieldRow>
      );
    }

    if (field.key === "start_date" || field.key === "due_date") {
      const value = field.key === "start_date" ? toDateInputValue(activeTask.startDate) : toDateInputValue(activeTask.dueDate);
      const updateKey = field.key === "start_date" ? "startDate" : "dueDate";
      return (
        <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
          <TaskInlineDateEditor
            className="w-full"
            value={value}
            onChange={(nextValue) => handleUpdate(activeTask.id, { [updateKey]: nextValue } as WorkItemUpdate)}
            triggerClassName="w-full"
            renderTrigger={(nextValue) => renderDateTrigger(nextValue, messages.common.select)}
          />
        </DetailFieldRow>
      );
    }

    if (!EDITABLE_SYSTEM_FIELD_KEY_SET.has(field.key)) {
      const storedValue = customFieldValueMap.get(field.id) ?? null;
      const parsedValue = parseStoredFieldValue(field, storedValue);

      if (field.type === "TEXT" || field.type === "URL" || field.type === "NUMBER") {
        return (
          <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
            <InlineTextEdit
              value={typeof parsedValue === "string" ? parsedValue : ""}
              placeholder={interpolate(messages.createTaskModal.enterField, { field: label })}
              onSave={(value) => saveCustomField(field, value)}
              allowEmpty
              className="mx-0 block w-full rounded-[var(--radius-md)] border border-transparent px-1.5 py-1 text-[length:var(--text-xs)] leading-5 text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]"
              inputClassName="h-8 rounded-[var(--radius-md)] px-1.5 py-1 text-[length:var(--text-xs)] leading-5"
            />
          </DetailFieldRow>
        );
      }

      if (field.type === "DATE") {
        return (
          <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
            <TaskInlineDateEditor
              className="w-full"
              value={typeof parsedValue === "string" ? parsedValue : null}
              onChange={(value) => saveCustomField(field, value)}
              triggerClassName="w-full"
              renderTrigger={(value) => renderDateTrigger(value, messages.common.select)}
            />
          </DetailFieldRow>
        );
      }

      if (field.type === "SELECT" || isSingleReferenceField(field)) {
        const referenceObjectKey = getReferenceObjectKey(field);
        const options: { value: string; label: string; color?: string | null }[] = isSingleReferenceField(field) && referenceObjectKey === "user"
          ? userOptions
          : field.type === "SELECT"
            ? parseFieldOptions(field.options).map((option) => ({
              value: option.value,
              label: option.label,
              color: option.color,
            }))
            : referenceOptionsByTarget[referenceObjectKey] ?? [];

        // 저장된 값이 현재 옵션에 없으면(삭제된 옵션) "(삭제된 옵션)" 표식과 함께 노출한다.
        const currentValue = typeof parsedValue === "string" ? parsedValue : "";
        if (field.type === "SELECT" && currentValue && !findReferenceOption(options, currentValue)) {
          options.push({ value: currentValue, label: messages.taskCommon.deletedOptionLabel, color: null });
        }
        const selectedValue = field.type === "SELECT" ? currentValue : canonicalizeReferenceValue(options, currentValue);

        return (
          <DetailFieldRow key={field.id} label={label} required={field.isRequired}>
            <Combobox
              className="w-full"
              options={options}
              value={selectedValue}
              onChange={(value) => saveCustomField(field, field.type === "SELECT" ? value || null : canonicalizeReferenceValue(options, value) || null)}
              renderTrigger={(option) =>
                option?.color
                  ? renderBadgeTrigger(<Badge color={option.color}>{option.label}</Badge>)
                  : renderTextTrigger(option?.label ?? messages.common.select)
              }
            />
          </DetailFieldRow>
        );
      }

      if (field.type === "MULTI_SELECT" || isMultiReferenceField(field)) {
        const referenceObjectKey = getReferenceObjectKey(field);
        const fieldOptions = isMultiReferenceField(field)
          ? [...(referenceOptionsByTarget[referenceObjectKey] ?? [])]
          : parseFieldOptions(field.options).map((option) => ({
            value: option.value,
            label: option.label,
            color: option.color as string | null,
          }));
        const selectedValues = new Set(isMultiReferenceField(field) && Array.isArray(parsedValue)
          ? canonicalizeReferenceValues(fieldOptions, parsedValue)
          : Array.isArray(parsedValue)
            ? parsedValue
            : []);

        // 현재 옵션에 없는 선택값(삭제된 옵션)도 표식과 함께 노출하여 해제할 수 있게 한다.
        for (const selectedValue of selectedValues) {
          if (typeof selectedValue === "string" && !findReferenceOption(fieldOptions, selectedValue)) {
            fieldOptions.push({ value: selectedValue, label: messages.taskCommon.deletedOptionLabel, color: null });
          }
        }

        const toggleOption = (optionValue: string) => {
          const next = new Set(selectedValues);
          const option = fieldOptions.find((entry) => entry.value === optionValue);
          const aliases = option ? getReferenceOptionAliases(option) : [optionValue];
          if (aliases.some((alias) => next.has(alias))) {
            for (const alias of aliases) next.delete(alias);
          } else {
            next.add(optionValue);
          }
          saveCustomField(field, next.size > 0 ? Array.from(next) : null);
        };

        return (
          <DetailFieldRow key={field.id} label={label} required={field.isRequired} align="start">
            <div className="flex max-h-32 w-full flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-1.5 py-1.5">
              {fieldOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[length:var(--text-xs)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.has(option.value)}
                    onChange={() => toggleOption(option.value)}
                    className="h-3 w-3 flex-shrink-0 accent-[var(--color-accent)]"
                  />
                  {option.color
                    ? <Badge color={option.color}>{option.label}</Badge>
                    : <span className="truncate">{option.label}</span>}
                </label>
              ))}
            </div>
          </DetailFieldRow>
        );
      }
    }

    return null;
  };

  async function handleUpdateComment(commentId: string) {
    if (!activeTask || !editingCommentBody.trim()) return;
    const response = await fetch(`/api/work-items/${activeTask.id}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingCommentBody.trim() }),
    });
    if (!response.ok) return;
    setEditingCommentId(null);
    setEditingCommentBody("");
    await queryClient.invalidateQueries({ queryKey: ["work-item-detail", activeTask.id] });
    onRefresh?.();
  }

  async function handleDeleteComment(commentId: string) {
    if (!activeTask) return;
    const confirmed = window.confirm(messages.taskDetailPanel.deleteCommentConfirm);
    if (!confirmed) return;
    const response = await fetch(`/api/work-items/${activeTask.id}/comments/${commentId}`, { method: "DELETE" });
    if (!response.ok) return;
    await queryClient.invalidateQueries({ queryKey: ["work-item-detail", activeTask.id] });
    onRefresh?.();
  }

  async function handleCreateComment() {
    if (!activeTask || !commentBody.trim() || isCreatingComment) return;

    setIsCreatingComment(true);
    try {
      const response = await fetch(`/api/work-items/${activeTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      if (!response.ok) return;

      await queryClient.invalidateQueries({ queryKey: ["work-item-detail", activeTask.id] });
      setCommentBody("");
      onRefresh?.();
    } finally {
      setIsCreatingComment(false);
    }
  }

  const renderSortToggle = () => (
    <button
      type="button"
      onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
      className="text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
    >
      {messages.taskWorkspace.sort}: {sortOrderLabel}
    </button>
  );

  if (!activeTask) return null;

  const beforeInfo = parentTask ? (
    <button
      type="button"
      onClick={() => onSelect?.(parentTask)}
      className="flex items-center gap-1.5 text-left text-[length:var(--text-2xs)] text-[var(--color-accent)] hover:underline"
    >
      <ArrowUpIcon className="h-3 w-3 shrink-0" />
      <span className="font-semibold">{parentTask.issueKey}</span>
      <span className="truncate">{parentTask.title}</span>
    </button>
  ) : null;

  const infoCards = (
    <>
      <InfoCard
        label={infoLabels.creator}
        primary={activeTask.creator?.name ?? infoLabels.unknown}
        secondary={activeTask.creator?.email}
      />
      <InfoCard
        label={infoLabels.modifier}
        primary={latestModifier?.name ?? infoLabels.unknown}
        secondary={
          latestModifierEntry
            ? <DateDisplay date={latestModifierEntry.createdAt} format="compact" />
            : infoLabels.noHistory
        }
      />
      <InfoCard
        label={infoLabels.createdAt}
        primary={<DateDisplay date={activeTask.createdAt} format="compact" />}
      />
      <InfoCard
        label={infoLabels.updatedAt}
        primary={<DateDisplay date={activeTask.updatedAt} format="compact" />}
      />
    </>
  );

  const mainColumn = (
    <>
      <SectionCard title={messages.taskWorkspace.filterFields.description}>
        <DetailBodyEditor
          value={activeTask.description ?? ""}
          placeholder={messages.createTaskModal.enterField.replace("{field}", messages.taskWorkspace.filterFields.description)}
          projectKey={activeTask.projectId ?? ""}
          onSave={(description) => handleUpdate(activeTask.id, { description })}
          mentionRefs={activeTaskMentionRefs}
        />
      </SectionCard>

      <SectionCard title={detailPanelMessages.childItems}>
        {panelDisplayTasks.length === 0 ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            {detailPanelMessages.noChildItems}
          </div>
        ) : (
          <div className="-mx-5">
            <TaskList
              tasks={panelDisplayTasks}
              statuses={statuses}
              issueTypes={resolvedIssueTypes}
              allowedStatusIdsByIssueType={projectConfig?.perTypeAllowedStatuses}
              onUpdate={onUpdate}
              onSelect={(task) => {
                onSelect?.(task);
                if (contentScrollRef.current) {
                  contentScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              splitHierarchy={false}
              hierarchyDepthById={panelDepthById}
              hasChildrenIds={panelHasChildrenIds}
              collapsedIds={panelCollapsedIds}
              onToggleCollapse={(id) =>
                setPanelCollapsedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) {
                    next.delete(id);
                  } else {
                    next.add(id);
                  }
                  return next;
                })
              }
              fieldVisibility={{
                issueKey: true,
                status: true,
                issueType: false,
                assignee: false,
                startDate: false,
                dueDate: false,
                createdAt: false,
                updatedAt: false,
                commentCount: false,
                childCount: false,
              }}
            />
          </div>
        )}
      </SectionCard>

      <div ref={commentsSectionRef}>
        <SectionCard title={detailPanelMessages.comments} action={renderSortToggle()}>
          <div className="space-y-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
              <RichTextEditor
                projectKey={activeTask.projectId ?? ""}
                value={commentBody}
                onChange={setCommentBody}
                variant="compact"
                placeholder={detailPanelMessages.commentPlaceholder}
                toolbarLabels={messages.richTextEditor.toolbar}
                mentionEnabled={Boolean(activeTask.projectId)}
                onSubmit={handleCreateComment}
                minHeight="72px"
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={handleCreateComment} disabled={!commentBody.trim() || isCreatingComment}>
                  {isCreatingComment ? detailPanelMessages.addingComment : detailPanelMessages.addComment}
                </Button>
              </div>
            </div>

            {comments.length === 0 ? (
              <TaskEmptyState
                title={detailPanelMessages.noComments}
                description={detailPanelMessages.noCommentsDescription}
                icon={<CommentBubbleIcon className="h-5 w-5" />}
                className="py-10"
              />
            ) : (
              <div className="space-y-2">
                {comments.map((comment) => {
                  const isEditing = editingCommentId === comment.id;
                  return (
                    <div key={comment.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                        {comment.author ? (
                          <UserName user={comment.author} withAvatar avatarSize="xs" labelClassName="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]" />
                        ) : (
                          <span>{infoLabels.unknown}</span>
                        )}
                        <div className="flex items-center gap-2">
                          <DateDisplay date={comment.createdAt} format="full" />
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingCommentId(null);
                                setEditingCommentBody("");
                              } else {
                                setEditingCommentId(comment.id);
                                setEditingCommentBody(comment.body);
                              }
                            }}
                            className="transition-colors hover:text-[var(--color-text-primary)]"
                          >
                            {isEditing ? detailPanelMessages.cancel : detailPanelMessages.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="transition-colors hover:text-[var(--color-danger)]"
                          >
                            {detailPanelMessages.delete}
                          </button>
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <RichTextEditor
                            projectKey={activeTask.projectId ?? ""}
                            value={editingCommentBody}
                            onChange={setEditingCommentBody}
                            variant="compact"
                            toolbarLabels={messages.richTextEditor.toolbar}
                            mentionEnabled={Boolean(activeTask.projectId)}
                            autoFocus
                            onSubmit={() => handleUpdateComment(comment.id)}
                            minHeight="72px"
                          />
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => handleUpdateComment(comment.id)} disabled={!editingCommentBody.trim()}>
                              {detailPanelMessages.save}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <RichTextRenderer
                            content={comment.body}
                            className="text-[length:var(--text-sm)] leading-6 text-[var(--color-text-primary)]"
                            mentionRefs={activeTaskMentionRefs}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title={detailPanelMessages.history} action={renderSortToggle()}>
        {histories.length === 0 ? (
          <TaskEmptyState
            title={detailPanelMessages.noHistoryTitle}
            description={detailPanelMessages.noHistoryDescription}
            icon={<CommentBubbleIcon className="h-5 w-5" />}
            className="py-10"
          />
        ) : (
          <div className="space-y-2">
            {histories.map((history) => (
              <div key={history.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
                  {history.actor ? (
                    <UserName user={history.actor} withAvatar avatarSize="xs" labelClassName="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)]" />
                  ) : (
                    <span>{infoLabels.unknown}</span>
                  )}
                  <DateDisplay date={history.createdAt} format="full" />
                </div>
                <p className="mt-2 break-words text-[length:var(--text-sm)] leading-6 text-[var(--color-text-primary)]">
                  {history.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );

  const sideColumn = (
    <SectionCard title={messages.taskWorkspace.fields}>
      <div className="space-y-2">
        <DetailFieldRow label={messages.createTaskModal.issueType} required>
          <Combobox
            className="w-full"
            options={typeOptions}
            value={activeTask.issueTypeId}
            onChange={(issueTypeId) => {
              if (issueTypeId === activeTask.issueTypeId) return;
              if (onEditInModal) {
                onEditInModal(activeTask, issueTypeId);
                return;
              }
              handleUpdate(activeTask.id, { issueTypeId });
            }}
            renderTrigger={(option) => renderBadgeTrigger(
              <Badge color={option?.color ?? activeTask.issueType.color ?? undefined} className="px-2 py-0.5 text-[length:var(--text-2xs)]">
                {option?.label ?? activeTask.issueType.name}
              </Badge>
            )}
          />
        </DetailFieldRow>

        {editableSchemaFields.map((field) => renderSchemaField(field))}
      </div>
    </SectionCard>
  );

  return (
    <DetailPanelShell
      open
      ariaLabel={detailPanelMessages.ariaLabel}
      eyebrow={activeTask.issueKey}
      title={(
        <InlineTextEdit
          value={activeTask.title}
          onSave={(title) => handleUpdate(activeTask.id, { title })}
          className={titleFieldClassName}
          inputClassName={titleFieldInputClassName}
        />
      )}
      actions={(
        <>
          <TaskWatchersButton
            workItemId={activeTask.id}
            projectKey={activeTask.projectId ?? null}
          />
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onDelete(activeTask.id);
                onClose();
              }}
              className="text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
            >
              {messages.common.delete}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={messages.common.close}>
            {messages.common.close}
          </Button>
        </>
      )}
      beforeInfo={beforeInfo}
      infoCards={infoCards}
      main={mainColumn}
      side={sideColumn}
      contentRef={contentScrollRef}
      onClose={onClose}
    />
  );
}
