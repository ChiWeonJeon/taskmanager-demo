"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  IssueTypeField,
  IssueTypeOption,
  ProjectOption,
  ResolvedProjectConfig,
  UserOption,
  WorkItemWithRelations,
} from "@/components/task/types";
import {
  EDITABLE_SYSTEM_FIELD_KEY_SET,
  ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET,
  LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET,
  getIssueTypeSchemaFields,
  isFieldValuePresent,
  parseFieldOptions,
  parseStoredFieldValue,
} from "@/lib/field-schema";
import { useToast } from "@/lib/toast";
import { useI18n } from "@/components/shared/locale-provider";
import { sortProjectsForUser, UserProjectOrderEntry } from "@/lib/project-sort";
import { Modal } from "@/components/ui/modal";
import {
  getReferenceObjectKey,
  isMultiReferenceField,
  isSingleReferenceField,
  useObjectReferenceOptions,
} from "@/components/task/use-object-reference-options";
import { canonicalizeReferenceValue, canonicalizeReferenceValues, getReferenceOptionAliases } from "@/lib/reference-options";

interface MemberOption {
  user: UserOption;
}

interface ParentOption {
  id: string;
  issueKey: string;
  title: string;
}

type DynamicFieldValue = string | string[] | null;

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  defaultProjectId?: string;
  allowNoProject?: boolean;
  restrictToProjectIds?: string[];
  task?: WorkItemWithRelations | null;
  targetIssueTypeId?: string;
  initialValues?: {
    title?: string;
    description?: string;
    startDate?: string;
    dueDate?: string;
  };
}

function interpolate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template
  );
}

function getProjectOptionLabel(project: ProjectOption, personalProjectLabel: string) {
  if (project.isPersonal) return personalProjectLabel;
  return `[${project.key}] ${project.name}`;
}

function getFieldLabel(messages: ReturnType<typeof useI18n>["messages"], field: IssueTypeField) {
  switch (field.key) {
    case "title":
      return messages.createTaskModal.taskTitle;
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

function isHiddenSchemaField(field: IssueTypeField) {
  return LOCKED_READ_ONLY_SYSTEM_FIELD_KEY_SET.has(field.key)
    || ENTITY_RECORD_EXCLUDED_FIELD_KEY_SET.has(field.key);
}

function getInitialFieldValues(task?: WorkItemWithRelations | null) {
  if (!task?.fieldValues) return {} as Record<string, DynamicFieldValue>;

  const next: Record<string, DynamicFieldValue> = {};
  for (const fieldValue of task.fieldValues) {
    next[fieldValue.fieldId] = parseStoredFieldValue(fieldValue.field, fieldValue.value);
  }
  return next;
}

// 새 일감 생성 시, 사용자가 건드리지 않은 커스텀 필드에 (필드 스키마 우선) 기본값을 채운다.
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

export function CreateTaskModal({
  onClose,
  onSuccess,
  defaultProjectId,
  allowNoProject = true,
  restrictToProjectIds,
  task,
  targetIssueTypeId,
  initialValues,
}: Props) {
  const mode = task ? "edit" : "create";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const { messages } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(task?.title ?? initialValues?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? initialValues?.description ?? "");
  const [statusId, setStatusId] = useState<string | null>(task?.statusId ?? null);
  const [issueTypeId, setIssueTypeId] = useState<string | null>(targetIssueTypeId ?? task?.issueTypeId ?? null);
  const [projectId, setProjectId] = useState<string | null>(task?.projectId ?? defaultProjectId ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assignee?.id ?? null);
  const [parentId, setParentId] = useState(task?.parentId ?? "");
  const [startDate, setStartDate] = useState(task?.startDate?.slice(0, 10) ?? initialValues?.startDate ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? initialValues?.dueDate ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, DynamicFieldValue>>(() => getInitialFieldValues(task));
  const initialFieldValues = getInitialFieldValues(task);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const { data: statuses = [] } = useQuery({
    queryKey: ["statuses"],
    queryFn: async () => {
      const res = await fetch("/api/statuses");
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json() as Promise<NonNullable<IssueTypeOption["statusSchema"]>["statuses"][number]["status"][]>;
    },
  });

  const { data: issueTypes = [] } = useQuery<IssueTypeOption[]>({
    queryKey: ["issue-types"],
    queryFn: async () => {
      const res = await fetch("/api/issue-types");
      if (!res.ok) throw new Error("Failed to fetch issue types");
      return res.json();
    },
  });

  const { data: rawProjects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects?memberId=me");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });
  const { data: userOrder = [] } = useQuery<UserProjectOrderEntry[]>({
    queryKey: ["user-project-order"],
    queryFn: async () => {
      const res = await fetch("/api/user/preferences/project-order");
      return res.ok ? res.json() : [];
    },
  });
  const projects = useMemo(() => {
    const sorted = sortProjectsForUser(rawProjects, userOrder);
    if (!restrictToProjectIds || restrictToProjectIds.length === 0) return sorted;
    const allow = new Set(restrictToProjectIds);
    return sorted.filter((p) => allow.has(p.id));
  }, [rawProjects, userOrder, restrictToProjectIds]);

  const fallbackProjectId = task?.projectId
    ?? defaultProjectId
    ?? projects.find((project) => project.isPersonal)?.id
    ?? projects[0]?.id
    ?? "";
  const resolvedProjectId = projectId ?? fallbackProjectId;

  const { data: projectConfig } = useQuery<ResolvedProjectConfig>({
    queryKey: ["project-config", resolvedProjectId],
    enabled: Boolean(resolvedProjectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${resolvedProjectId}/config`);
      if (!res.ok) throw new Error("Failed to fetch project configuration");
      return res.json();
    },
  });

  const { data: projectMembers = [] } = useQuery<UserOption[]>({
    queryKey: ["project-members", resolvedProjectId],
    enabled: Boolean(resolvedProjectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${resolvedProjectId}/members`);
      if (!res.ok) throw new Error("Failed to fetch project members");
      const members = (await res.json()) as MemberOption[];
      return members.map((member) => member.user);
    },
  });

  const { data: parentCandidates = [] } = useQuery<ParentOption[]>({
    queryKey: ["work-items", "parent-candidates", resolvedProjectId, task?.id],
    enabled: Boolean(resolvedProjectId),
    queryFn: async () => {
      const res = await fetch(`/api/work-items?projectId=${resolvedProjectId}&fields=id,issueKey,title`);
      if (!res.ok) throw new Error("Failed to fetch parent work items");
      const items = (await res.json()) as ParentOption[];
      return items.filter((item) => item.id !== task?.id);
    },
  });

  const availableIssueTypes = useMemo(() => {
    const scopedIssueTypes = resolvedProjectId ? projectConfig?.enabledIssueTypes ?? [] : issueTypes;
    const next = [...scopedIssueTypes];
    const preservedIssueTypeIds = [targetIssueTypeId, task?.issueTypeId].filter(
      (value): value is string => Boolean(value),
    );

    for (const preservedIssueTypeId of preservedIssueTypeIds) {
      if (next.some((issueType) => issueType.id === preservedIssueTypeId)) continue;
      const preservedIssueType = issueTypes.find((issueType) => issueType.id === preservedIssueTypeId);
      if (preservedIssueType) next.push(preservedIssueType);
    }

    return next;
  }, [issueTypes, projectConfig?.enabledIssueTypes, resolvedProjectId, targetIssueTypeId, task?.issueTypeId]);
  const fallbackIssueTypeId =
    (targetIssueTypeId && availableIssueTypes.some((issueType) => issueType.id === targetIssueTypeId)
      ? targetIssueTypeId
      : null)
    ?? (task?.issueTypeId && availableIssueTypes.some((issueType) => issueType.id === task.issueTypeId)
      ? task.issueTypeId
      : null)
    ?? (projectConfig?.defaultIssueTypeId && availableIssueTypes.some((issueType) => issueType.id === projectConfig.defaultIssueTypeId)
      ? projectConfig.defaultIssueTypeId
      : null)
    ?? availableIssueTypes[0]?.id
    ?? "";
  const requestedIssueTypeId = issueTypeId ?? fallbackIssueTypeId;
  const resolvedIssueTypeId = availableIssueTypes.some((issueType) => issueType.id === requestedIssueTypeId)
    ? requestedIssueTypeId
    : fallbackIssueTypeId;

  const selectedIssueType = useMemo(
    () => resolvedIssueTypeId
      ? availableIssueTypes.find((issueType) => issueType.id === resolvedIssueTypeId) ?? null
      : null,
    [availableIssueTypes, resolvedIssueTypeId]
  );
  const issueTypeFields = useMemo(() => getIssueTypeSchemaFields(selectedIssueType), [selectedIssueType]);
  const editableIssueTypeFields = useMemo(
    () => issueTypeFields.filter((field) => !isHiddenSchemaField(field)),
    [issueTypeFields]
  );
  const visibleIssueTypeFields = useMemo(
    () => editableIssueTypeFields.filter((field) => field.key !== "title"),
    [editableIssueTypeFields]
  );
  const customFields = useMemo(
    () => visibleIssueTypeFields.filter((field) => !EDITABLE_SYSTEM_FIELD_KEY_SET.has(field.key)),
    [visibleIssueTypeFields]
  );
  const { data: referenceOptionsByTarget = {} } = useObjectReferenceOptions(customFields, resolvedProjectId);
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
  useEffect(() => {
    if (mode !== "create") return;
    const defaults = getSchemaDefaultFieldValues(customFields);
    // 선택된 이슈 유형의 스키마 기본값을 비어 있는 필드에만 채운다(사용자 입력은 보존).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFieldValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [fieldId, value] of Object.entries(defaults)) {
        if (next[fieldId] === undefined) {
          next[fieldId] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [mode, customFields]);
  const availableStatuses = useMemo(
    () => selectedIssueType?.statusSchema?.statuses.map((entry) => entry.status) ?? statuses,
    [selectedIssueType, statuses]
  );
  const configuredStartStatusId = selectedIssueType?.statusSchema?.startStatusId ?? null;
  const fallbackStatusId =
    (configuredStartStatusId && availableStatuses.some((status) => status.id === configuredStartStatusId)
      ? configuredStartStatusId
      : undefined)
    ?? availableStatuses.find((status) => status.key === "open")?.id
    ?? availableStatuses[0]?.id
    ?? "";
  const resolvedStatusId =
    statusId === ""
      ? ""
      : availableStatuses.some((status) => status.id === statusId)
        ? (statusId ?? "")
        : fallbackStatusId;

  const projectOptions = projects;
  const assigneeOptions = useMemo<UserOption[]>(
    () => (resolvedProjectId
      ? projectMembers
      : session?.user
        ? [{ id: session.user.id, name: session.user.name ?? messages.createTaskModal.me, email: session.user.email ?? "" }]
        : []),
    [resolvedProjectId, projectMembers, session, messages]
  );
  const fallbackAssigneeId = session?.user?.id && assigneeOptions.some((user) => user.id === session.user.id)
    ? session.user.id
    : assigneeOptions[0]?.id ?? "";
  const resolvedAssigneeId =
    assigneeId === ""
      ? ""
      : assigneeOptions.some((user) => user.id === assigneeId)
        ? (assigneeId ?? "")
        : fallbackAssigneeId;

  // 프로젝트 변경 등으로 현재 담당자가 새 프로젝트의 멤버가 아니게 되면 유효한 담당자로 보정하고
  // 사용자에게 알린다(조용한 변경 방지). 여전히 유효하면 보존하고, 명시적 미지정("")은 건드리지 않는다.
  useEffect(() => {
    if (!assigneeId) return; // null/"" → 보정 대상 아님
    if (!resolvedProjectId) return;
    if (assigneeOptions.length === 0) return; // 멤버 목록 로딩 전
    if (assigneeOptions.some((user) => user.id === assigneeId)) return; // 여전히 유효
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssigneeId(resolvedAssigneeId || null);
    toast(messages.createTaskModal.assigneeResetByProject, { type: "info" });
  }, [assigneeId, resolvedProjectId, assigneeOptions, resolvedAssigneeId, toast, messages]);

  const updateFieldValue = (fieldId: string, value: DynamicFieldValue) => {
    setFieldValues((current) => ({
      ...current,
      [fieldId]: value,
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payloadFieldValues: Record<string, DynamicFieldValue> = {};
      const clearFieldIds = new Set<string>();
      const initialValueMap = new Map(Object.entries(initialFieldValues));
      const currentCustomFieldIds = new Set(customFields.map((field) => field.id));

      for (const field of customFields) {
        const currentValue = fieldValues[field.id];
        const initialValue = initialValueMap.get(field.id) ?? null;

        const normalizedValue = normalizeReferenceFieldValue(field, currentValue ?? null);

        if (isFieldValuePresent(normalizedValue ?? undefined)) {
          payloadFieldValues[field.id] = normalizedValue;
        } else if (mode === "edit" && isFieldValuePresent(initialValue ?? undefined)) {
          clearFieldIds.add(field.id);
        }
      }

      if (mode === "edit") {
        for (const fieldValue of task?.fieldValues ?? []) {
          if (!currentCustomFieldIds.has(fieldValue.fieldId)) {
            clearFieldIds.add(fieldValue.fieldId);
          }
        }
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        statusId: resolvedStatusId || undefined,
        issueTypeId: selectedIssueType?.id,
        projectId: resolvedProjectId || undefined,
        assigneeId: resolvedAssigneeId || undefined,
        parentId: parentId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        fieldValues: payloadFieldValues,
        clearFieldIds: Array.from(clearFieldIds),
      };

      const url = mode === "edit" && task ? `/api/work-items/${task.id}` : "/api/work-items";
      const method = mode === "edit" && task ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (mode === "edit" ? "Failed to save work item." : messages.createTaskModal.createError));
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      if (task?.id) {
        await queryClient.invalidateQueries({ queryKey: ["work-item-detail", task.id] });
      }
      toast(mode === "edit" ? "Saved." : messages.createTaskModal.createSuccess, { type: "success" });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast(error.message, { type: "error", sticky: true });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedIssueType) {
      toast("Issue type is required.", { type: "error", sticky: true });
      return;
    }

    const missingField = editableIssueTypeFields.find((field) => {
      if (!field.isRequired) return false;

      switch (field.key) {
        case "title":
          return !title.trim();
        case "project":
          return !resolvedProjectId;
        case "status":
          return !resolvedStatusId;
        case "assignee":
          return !resolvedAssigneeId;
        case "parent":
          return !parentId;
        case "description":
          return !description.trim();
        case "start_date":
          return !startDate;
        case "due_date":
          return !dueDate;
        default:
          return !isFieldValuePresent(fieldValues[field.id] ?? undefined);
      }
    });

    if (missingField) {
      toast(interpolate(messages.createTaskModal.requiredField, { field: getFieldLabel(messages, missingField) }), {
        type: "error",
        sticky: true,
      });
      return;
    }

    mutation.mutate();
  };

  const renderField = (field: IssueTypeField) => {
    const label = getFieldLabel(messages, field);
    const labelNode = (
      <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
        {field.isRequired && <span className="ml-1 text-[var(--color-danger)]">*</span>}
      </label>
    );

    if (field.key === "title") {
      return (
        <div key={field.id}>
          {labelNode}
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={messages.createTaskModal.taskTitlePlaceholder}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
      );
    }

    if (field.key === "project") {
      return (
        <div key={field.id}>
          {labelNode}
          <select
            value={resolvedProjectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setIssueTypeId(null);
              setStatusId(null);
              setParentId("");
            }}
            disabled={mode === "create" && Boolean(defaultProjectId) && !allowNoProject}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{messages.common.select}</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {getProjectOptionLabel(project, messages.createTaskModal.personalProject)}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.key === "status") {
      return (
        <div key={field.id}>
          {labelNode}
          <select
            value={resolvedStatusId}
            onChange={(event) => setStatusId(event.target.value)}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{messages.common.select}</option>
            {availableStatuses.map((status) => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.key === "assignee") {
      return (
        <div key={field.id}>
          {labelNode}
          <select
            value={resolvedAssigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{messages.common.select}</option>
            {assigneeOptions.map((user) => (
              <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.key === "parent") {
      return (
        <div key={field.id}>
          {labelNode}
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            disabled={!resolvedProjectId}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">{messages.common.select}</option>
            {parentCandidates.map((item) => (
              <option key={item.id} value={item.id}>[{item.issueKey}] {item.title}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.key === "description") {
      return (
        <div key={field.id}>
          {labelNode}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder={interpolate(messages.createTaskModal.enterField, { field: label })}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
      );
    }

    if (field.key === "start_date" || field.key === "due_date") {
      const value = field.key === "start_date" ? startDate : dueDate;
      const onChange = field.key === "start_date" ? setStartDate : setDueDate;
      return (
        <div key={field.id}>
          {labelNode}
          <input
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
      );
    }

    const currentValue = fieldValues[field.id];
    const options = parseFieldOptions(field.options);

    switch (field.type) {
      case "TEXT":
      case "URL":
      case "NUMBER":
        return (
          <div key={field.id}>
            {labelNode}
            <input
              type={field.type === "NUMBER" ? "number" : field.type === "URL" ? "url" : "text"}
              value={typeof currentValue === "string" ? currentValue : ""}
              onChange={(event) => updateFieldValue(field.id, event.target.value)}
              placeholder={interpolate(messages.createTaskModal.enterField, { field: label })}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
        );
      case "DATE":
        return (
          <div key={field.id}>
            {labelNode}
            <input
              type="date"
              value={typeof currentValue === "string" ? currentValue : ""}
              onChange={(event) => updateFieldValue(field.id, event.target.value)}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
        );
      case "SELECT":
      case "USER":
      case "REFERENCE":
      case "OBJECT_REF":
      case "ENTITY_REF": {
        const referenceObjectKey = getReferenceObjectKey(field);
        const selectOptions = isSingleReferenceField(field) && referenceObjectKey === "user"
          ? assigneeOptions.map((user) => ({ value: user.id, label: `${user.name} (${user.email})` }))
          : field.type === "SELECT"
            ? options
            : referenceOptionsByTarget[referenceObjectKey] ?? [];
        return (
          <div key={field.id}>
            {labelNode}
            <Combobox
              className="w-full"
              options={selectOptions}
              value={field.type === "SELECT"
                ? (typeof currentValue === "string" ? currentValue : "")
                : canonicalizeReferenceValue(selectOptions, typeof currentValue === "string" ? currentValue : "")}
              onChange={(value) => updateFieldValue(field.id, field.type === "SELECT" ? value : canonicalizeReferenceValue(selectOptions, value))}
              renderTrigger={(option) => (
                <span className="flex h-10 w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  {option?.color
                    ? <Badge color={option.color}>{option.label}</Badge>
                    : <span className="truncate">{option?.label ?? messages.common.select}</span>}
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
        const referenceObjectKey = getReferenceObjectKey(field);
        const fieldOptions = isMultiReferenceField(field)
          ? referenceOptionsByTarget[referenceObjectKey] ?? []
          : options;
        const selectedSet = new Set(isMultiReferenceField(field) && Array.isArray(currentValue)
          ? canonicalizeReferenceValues(fieldOptions, currentValue)
          : Array.isArray(currentValue)
            ? currentValue
            : []);
        const toggleMultiOption = (optionValue: string) => {
          const next = new Set(selectedSet);
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
          <div key={field.id}>
            {labelNode}
            <div className="flex max-h-40 w-full flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-2">
              {fieldOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[var(--color-bg-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggleMultiOption(option.value)}
                    className="h-3.5 w-3.5 flex-shrink-0 accent-[var(--color-accent)]"
                  />
                  {option.color
                    ? <Badge color={option.color}>{option.label}</Badge>
                    : <span className="truncate">{option.label}</span>}
                </label>
              ))}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "edit" ? messages.common.save : messages.createTaskModal.title}
      size="lg"
      className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
      bodyClassName="min-h-0 flex-1 p-0"
    >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {messages.createTaskModal.issueType}
              </label>
              <Combobox
                className="w-full"
                options={availableIssueTypes.map((it) => ({ value: it.id, label: it.name, color: it.color }))}
                value={resolvedIssueTypeId}
                onChange={(value) => setIssueTypeId(value || null)}
                renderTrigger={(option) => (
                  <span className="flex h-10 w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                    {option?.color
                      ? <Badge color={option.color}>{option.label}</Badge>
                      : <span className="truncate">{option?.label ?? messages.common.select}</span>}
                  </span>
                )}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {messages.createTaskModal.taskTitle}
                {editableIssueTypeFields.some((field) => field.key === "title" && field.isRequired) && <span className="ml-1 text-[var(--color-danger)]">*</span>}
              </label>
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={messages.createTaskModal.taskTitlePlaceholder}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {visibleIssueTypeFields.map((field) => renderField(field))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-6">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>{messages.common.cancel}</Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (mode === "edit" ? messages.common.save : messages.common.createInProgress) : (mode === "edit" ? messages.common.save : messages.common.create)}
            </Button>
          </div>
        </form>
    </Modal>
  );
}
