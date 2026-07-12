"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TaskBar } from "@/components/task/task-bar";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { TaskGrid } from "@/components/task/task-grid";
import { TaskList } from "@/components/task/task-list";
import { TaskKanban } from "@/components/task/task-kanban";
import { TaskGantt } from "@/components/task/task-gantt";
import { TaskCalendar } from "@/components/task/task-calendar";
import { TaskDetailPanel } from "@/components/task/task-detail-panel";
import { BulkActionBar } from "@/components/task/bulk-action-bar";
import { BulkContextMenu } from "@/components/task/bulk-context-menu";
import { BulkEditSidePanel, taskToolSidePanelClass, type BulkPanelTab } from "@/components/task/bulk-edit-side-panel";
import { TaskColumnsPanel } from "@/components/task/task-columns-panel";
import { TaskGroupPanel } from "@/components/task/task-group-panel";
import { TaskSavedViews } from "@/components/task/task-saved-views";
import { useTaskColumnState } from "@/components/task/use-task-column-state";
import { useSavedViews } from "@/components/task/use-saved-views";
import { useTaskWorkspacePreference } from "@/components/task/use-task-workspace-preference";
import {
  BULK_WORK_ITEM_ACTION_LIMIT,
  useBulkWorkItemActions,
} from "@/components/task/use-bulk-work-item-actions";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CloseIcon,
  FieldsIcon,
  FilterIcon,
  FullscreenIcon,
  GroupIcon,
  HierarchyIcon,
  EyeOffIcon,
  MenuIcon,
  PlusIcon,
  SortIcon,
  TaskViewIcon,
  UserIcon,
} from "@/components/task/task-icons";
import {
  FILTER_FIELDS,
  FILTER_OPERATORS_BY_KIND,
  SORT_FIELDS,
  createFilterCondition,
  createFilterId,
  createSortRule,
  filterConditionHasValue,
  filterConditionStringValue,
  filterRequiresValue,
  getFilterFieldKind,
  matchesFilterCondition,
  normalizeOperatorForKind,
  parseTaskFilters,
  parseTaskSort,
  sanitizeTaskFilterConditions,
  serializeTaskFilters,
  serializeTaskSort,
  sortItems,
  toDateFieldValue,
  type FilterCombinator,
  type FilterCondition,
  type FilterFieldKey,
  type FilterFieldKind,
  type FilterOperator,
  type SortDirection,
  type SortFieldKey,
  type SortRule,
} from "@/components/task/task-filter-model";
import { useI18n } from "@/components/shared/locale-provider";
import { ContextMenu } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { Input } from "@/components/ui/input";
import { FloatingPortal } from "@/components/ui/floating-portal";
import { useObjectReferenceOptions } from "@/components/task/use-object-reference-options";
import {
  featureToolbarBadgeClass,
  featureToolbarButtonClass,
  featureToolbarButtonActiveClass,
  featureToolbarLabelClass,
  featureToolbarResponsiveLabelClass,
  featureToolbarSegmentButtonClass,
  featureToolbarSegmentedClass,
  featureToolbarSurfaceClass,
} from "@/components/layout/feature-toolbar";
import { canQuickCreateSatisfyRequiredFields, taskHasMissingRequiredSchemaFields } from "@/lib/field-schema";
import { buildWorkspaceFields, getTaskCustomFieldValue, isDynamicWorkspaceField } from "@/lib/workspace-field-model";
import {
  buildOrderedTaskColumns,
  countHiddenColumns,
  normalizeColumnOrder,
  parseTaskColumnState,
  taskColumnStorageKey,
  visibleCustomFieldIdSet,
  visibleSystemFieldState,
  type TaskWorkspaceColumn,
} from "@/lib/task-column-model";
import type {
  TaskWorkspacePreferenceInput,
  TaskWorkspaceTodayBucket,
} from "@/lib/task-workspace-preference";
import {
  normalizeTaskSavedViewConfig,
  type TaskSavedViewConfig,
  type TaskSavedViewDto,
} from "@/lib/task-saved-view";
import {
  getTaskGroupOptions,
  groupTasks,
  type TaskGroupSection,
} from "@/components/task/task-group-model";
import { findReferenceOption, mergeReferenceOptions } from "@/lib/reference-options";
import { cn } from "@/lib/utils";
import { DEFAULT_TASK_COLUMN_WIDTHS, IssueTypeOption, ProjectOption, ResolvedProjectConfig, StatusOption, TaskColumnKey, TaskSubtaskProgress, UserOption, WorkItemUpdate, WorkItemWithRelations } from "@/components/task/types";

const isReadOnlyDemo = process.env.NEXT_PUBLIC_DEMO_READ_ONLY === "true";

type ViewMode = "list" | "grid" | "kanban" | "gantt" | "calendar";
type TaskWorkspaceVariant = "default" | "today";
type TodayBucket = TaskWorkspaceTodayBucket;
type GanttDisplayUnit = "day" | "week" | "month" | "quarter";
type FullscreenView = ViewMode;
type TaskToolPanel = "filter" | "sort" | "columns" | "group" | "bulk";
type TaskContextMenuState =
  | { kind: "single"; task: WorkItemWithRelations; x: number; y: number }
  | { kind: "bulk"; x: number; y: number };

interface TaskWorkspaceProps {
  variant?: TaskWorkspaceVariant;
  title?: string;
  description?: string;
  tasks: WorkItemWithRelations[];
  isLoading: boolean;
  statuses: StatusOption[];
  issueTypes: IssueTypeOption[];
  projects: ProjectOption[];
  forceMyTasks?: boolean;
  savedViewsWorkspaceKey: string;
  preferenceWorkspaceKey?: string;
  workspaceProjectId?: string;
  onCreateTask?: (payload: {
    title: string;
    projectId?: string;
    issueTypeId?: string;
  }) => void;
  createPending?: boolean;
  defaultCreateProjectId?: string;
  createProjectIds?: string[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: WorkItemUpdate) => void;
  onRefresh: () => void;
}

interface ProjectMemberResponse {
  user: UserOption;
}

const panelSelectTriggerClassName =
  "h-9 w-full justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/15";

const panelSelectChevronClassName = "h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]";

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateValue(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfMonthValue(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function endOfMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month, 0);
  return `${value.slice(0, 7)}-${String(date.getDate()).padStart(2, "0")}`;
}

function resolveAutoGanttRange(tasks: WorkItemWithRelations[]) {
  const startDates = tasks.map((task) => toDateFieldValue(task.startDate)).filter((value): value is string => Boolean(value)).sort();
  const dueDates = tasks.map((task) => toDateFieldValue(task.dueDate)).filter((value): value is string => Boolean(value)).sort();

  if (startDates.length === 0 && dueDates.length === 0) {
    const today = todayDateValue();
    return { start: startOfMonthValue(today), end: endOfMonthValue(today) };
  }

  const start = startOfMonthValue(startDates[0] ?? dueDates[0]);
  const end = endOfMonthValue(dueDates[dueDates.length - 1] ?? startDates[startDates.length - 1]);
  return start <= end ? { start, end } : { start: end, end: start };
}

function getProjectMemberIds(tasks: WorkItemWithRelations[]) {
  return Array.from(new Set(tasks.map((task) => task.projectId).filter((value): value is string => Boolean(value))));
}

function buildHierarchy(
  tasks: WorkItemWithRelations[],
  splitHierarchy: boolean,
  collapsedIds: Set<string>
) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const childMap = new Map<string, WorkItemWithRelations[]>();
  const order = new Map(tasks.map((task, index) => [task.id, index]));

  for (const task of tasks) {
    if (!task.parentId || !taskById.has(task.parentId)) continue;
    const next = childMap.get(task.parentId) ?? [];
    next.push(task);
    childMap.set(task.parentId, next);
  }

  for (const children of childMap.values()) {
    children.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  const depthMap = new Map<string, number>();
  const hasChildrenIds = new Set<string>(Array.from(childMap.keys()));
  const allChildCountById = new Map<string, number>(
    Array.from(childMap.entries()).map(([id, children]) => [id, children.length])
  );
  const childProgressById = new Map<string, TaskSubtaskProgress>(
    Array.from(childMap.entries()).map(([id, children]) => [
      id,
      {
        total: children.length,
        done: children.filter((child) => child.status.category === "DONE").length,
      },
    ])
  );
  if (splitHierarchy) {
    return { displayTasks: tasks, depthMap, hasChildrenIds, allChildCountById, childProgressById };
  }

  const roots = tasks.filter((task) => !task.parentId || !taskById.has(task.parentId));
  const displayTasks: WorkItemWithRelations[] = [];

  function visit(task: WorkItemWithRelations, depth: number) {
    displayTasks.push(task);
    depthMap.set(task.id, depth);
    if (collapsedIds.has(task.id)) return;
    for (const child of childMap.get(task.id) ?? []) {
      visit(child, depth + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  return { displayTasks, depthMap, hasChildrenIds, allChildCountById, childProgressById };
}

export function TaskWorkspace({
  variant = "default",
  title,
  description,
  tasks,
  isLoading,
  statuses,
  issueTypes,
  projects,
  forceMyTasks = false,
  savedViewsWorkspaceKey,
  preferenceWorkspaceKey,
  workspaceProjectId,
  onCreateTask,
  createPending,
  defaultCreateProjectId,
  createProjectIds,
  onDelete,
  onUpdate,
  onRefresh,
}: TaskWorkspaceProps) {
  const todayMode = variant === "today";
  const { data: session } = useSession();
  const { locale, messages } = useI18n();
  const currentUserId = session?.user?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskIdFromUrl = searchParams?.get("task") ?? null;
  const cycleIdFromUrl = searchParams?.get("cycle") ?? null;
  const [activeViewId, setActiveViewId] = useState<string | null>(() => searchParams?.get("view") || null);
  const cleanAppliedViewIdRef = useRef<string | null>(null);
  const urlViewAppliedRef = useRef<string | null>(null);
  const defaultSavedViewAppliedRef = useRef(false);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const effectiveViewMode: ViewMode = todayMode ? "list" : viewMode;
  const [fullscreenView, setFullscreenView] = useState<FullscreenView | null>(null);
  const [selectedTask, setSelectedTask] = useState<WorkItemWithRelations | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<TaskContextMenuState | null>(null);
  const [activeToolPanel, setActiveToolPanel] = useState<TaskToolPanel | null>(null);
  const [bulkPanelTab, setBulkPanelTab] = useState<BulkPanelTab>("field");
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [sortRules, setSortRules] = useState<SortRule[]>(() => parseTaskSort(searchParams?.get("sort")));
  const [groupBy, setGroupBy] = useState<string | null>(() => searchParams?.get("group") || null);
  const [splitHierarchy, setSplitHierarchy] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [panelScrollRequest, setPanelScrollRequest] = useState<{ taskId: string; target: "comments"; requestId: number } | null>(null);
  const [createTaskPreset, setCreateTaskPreset] = useState<{ title?: string; startDate?: string; dueDate?: string } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalState, setEditModalState] = useState<{ task: WorkItemWithRelations; targetIssueTypeId?: string } | null>(null);
  const [filterCombinator, setFilterCombinator] = useState<FilterCombinator>(() => (searchParams?.get("combinator") === "OR" ? "OR" : "AND"));
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>(() => {
    const parsed = parseTaskFilters(searchParams?.get("filter"));
    const base = [...parsed];
    // URL의 `?assignee=<userId>`가 있으면 담당자 필터를 초기값에 시드한다.
    // 멤버 탭에서 행 클릭 시 진입하는 PRE-FILTER 경로. lazy init을 사용해 첫 렌더부터 필터를 적용한다.
    const assigneeId = searchParams?.get("assignee");
    if (assigneeId && !base.some((condition) => condition.field === "assignee")) {
      base.push({ ...createFilterCondition("assignee"), value: [assigneeId] });
    }
    return base;
  });
  const [filterDraftField, setFilterDraftField] = useState<FilterFieldKey | "">("");
  const [filterDraftOperator, setFilterDraftOperator] = useState<FilterOperator>("contains");
  const [filterDraftValue, setFilterDraftValue] = useState<string | string[]>("");
  const [filterDraftValue2, setFilterDraftValue2] = useState("");
  // forceMyTasks 화면(/tasks)에서는 본인 담당자 필터를 잠금 칩으로 자동 부착하고
  // 사용자가 제거/편집할 수 없도록 한다. session에서 currentUserId가 비동기로 도착하므로
  // effect로 시드하되 idempotent 가드를 둔다 (이미 잠금 칩이 있으면 no-op).
  useEffect(() => {
    if (!forceMyTasks || !currentUserId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterConditions((current) => {
      if (current.some((c) => c.locked && c.field === "assignee")) return current;
      const stripped = current.filter((c) => c.field !== "assignee");
      return [
        ...stripped,
        {
          id: createFilterId(),
          field: "assignee",
          operator: "in",
          value: [currentUserId],
          locked: true,
        },
      ];
    });
  }, [forceMyTasks, currentUserId]);
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [todayBucket, setTodayBucket] = useState<TodayBucket>("byToday");
  const [excludeDone, setExcludeDone] = useState(false);
  const [columnWidths, setColumnWidths] = useState(DEFAULT_TASK_COLUMN_WIDTHS);
  const [ganttRangeMode, setGanttRangeMode] = useState<"auto" | "custom">("auto");
  const [ganttUnit, setGanttUnit] = useState<GanttDisplayUnit>("month");
  const [calendarUnit, setCalendarUnit] = useState<GanttDisplayUnit>(() => {
    if (typeof window === "undefined") return "month";
    if (typeof window.matchMedia !== "function") return "month";
    return window.matchMedia("(max-width: 767px)").matches ? "day" : "month";
  });
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => todayDateValue());
  const [customGanttRange, setCustomGanttRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [ganttRangeDraft, setGanttRangeDraft] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [ganttRangeOpen, setGanttRangeOpen] = useState(false);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [viewModeMenuOpen, setViewModeMenuOpen] = useState(false);
  const [workspaceViewportHeight, setWorkspaceViewportHeight] = useState<number | null>(null);
  const savedViewsQuery = useSavedViews(savedViewsWorkspaceKey, Boolean(savedViewsWorkspaceKey), messages.taskWorkspace.savedView.loadFailed);
  const resolvedPreferenceWorkspaceKey = preferenceWorkspaceKey ?? savedViewsWorkspaceKey;
  const { query: workspacePreferenceQuery, save: saveWorkspacePreference } = useTaskWorkspacePreference(
    resolvedPreferenceWorkspaceKey,
    Boolean(currentUserId && resolvedPreferenceWorkspaceKey),
  );
  const preferenceAppliedKeyRef = useRef<string | null>(null);
  const legacyColumnStorageKeyRef = useRef<string | null>(null);
  const savedViewsData = savedViewsQuery.data ?? { views: [], defaultViewId: null };
  const canManageSavedViewDefaults = session?.user?.role === "ADMIN";
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const ganttRangeButtonRef = useRef<HTMLButtonElement>(null);
  const ganttRangePanelRef = useRef<HTMLDivElement>(null);
  const viewSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const viewSettingsPanelRef = useRef<HTMLDivElement>(null);
  const viewModeMenuButtonRef = useRef<HTMLButtonElement>(null);
  const viewModeMenuPanelRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const workspaceShellRef = useRef<HTMLDivElement>(null);
  const panelScrollRequestIdRef = useRef(0);
  const filterUrlSyncedRef = useRef(false);
  const bulkSelectionAnchorRef = useRef<string | null>(null);
  const getBulkSelectionAnchorId = useCallback(() => bulkSelectionAnchorRef.current, []);
  const setBulkSelectionAnchorId = useCallback((id: string | null) => {
    bulkSelectionAnchorRef.current = id;
  }, []);

  const projectIdsForMembers = useMemo(() => getProjectMemberIds(tasks), [tasks]);
  const projectMemberQueries = useQueries({
    queries: projectIdsForMembers.map((projectId) => ({
      queryKey: ["project-members", projectId],
      enabled: Boolean(projectId),
      staleTime: 30_000,
      queryFn: async () => {
        const response = await fetch(`/api/projects/${projectId}/members`);
        if (!response.ok) throw new Error("Failed to fetch project members");
        const members = (await response.json()) as ProjectMemberResponse[];
        return members.map((member) => member.user);
      },
    })),
  });

  const projectConfigQueries = useQueries({
    queries: projectIdsForMembers.map((projectId) => ({
      queryKey: ["project-config", projectId],
      enabled: Boolean(projectId),
      staleTime: 30_000,
      queryFn: async () => {
        const response = await fetch(`/api/projects/${projectId}/config`);
        if (!response.ok) throw new Error("Failed to fetch project configuration");
        return response.json() as Promise<ResolvedProjectConfig>;
      },
    })),
  });

  const projectMembersByProjectId = useMemo(() => {
    const next = new Map<string, UserOption[]>();
    projectIdsForMembers.forEach((projectId, index) => {
      next.set(projectId, projectMemberQueries[index]?.data ?? []);
    });
    return next;
  }, [projectIdsForMembers, projectMemberQueries]);

  const issueTypesByProjectId = useMemo(() => {
    const next = {} as Record<string, IssueTypeOption[]>;
    projectIdsForMembers.forEach((projectId, index) => {
      const config = projectConfigQueries[index]?.data;
      if (config) next[projectId] = config.enabledIssueTypes;
    });
    return next;
  }, [projectConfigQueries, projectIdsForMembers]);

  const projectConfigByProjectId = useMemo(() => {
    const next = {} as Record<string, ResolvedProjectConfig>;
    projectIdsForMembers.forEach((projectId, index) => {
      const config = projectConfigQueries[index]?.data;
      if (config) next[projectId] = config;
    });
    return next;
  }, [projectConfigQueries, projectIdsForMembers]);
  const projectConfigLoading = projectConfigQueries.some((query) => query.isLoading);

  // 멀티뷰 구성표 단일 모델: 로드된 tasks 가 속한 프로젝트들의 unionFields 합집합.
  const baseWorkspaceFields = useMemo(
    () => buildWorkspaceFields(tasks, Object.values(projectConfigByProjectId)),
    [tasks, projectConfigByProjectId],
  );
  const baseCustomWorkspaceFields = useMemo(
    () => baseWorkspaceFields.filter(isDynamicWorkspaceField),
    [baseWorkspaceFields],
  );
  const workspaceReferenceFields = useMemo(
    () => baseCustomWorkspaceFields.map((field) => ({
      id: field.id,
      key: field.key,
      name: field.name,
      type: field.type,
      options: null,
      referenceObjectKey: field.referenceObjectKey,
      isSystem: field.isSystem,
      isRequired: false,
    })),
    [baseCustomWorkspaceFields],
  );
  const { data: workspaceReferenceOptionsByTarget = {} } = useObjectReferenceOptions(workspaceReferenceFields, workspaceProjectId);
  const workspaceFields = useMemo(
    () => baseWorkspaceFields.map((field) => {
      const referenceObjectKey = field.type === "USER" ? "user" : field.referenceObjectKey;
      const dynamicOptions = referenceObjectKey ? workspaceReferenceOptionsByTarget[referenceObjectKey] ?? [] : [];
      if (dynamicOptions.length === 0) return field;
      return {
        ...field,
        options: mergeReferenceOptions(field.options, dynamicOptions),
      };
    }),
    [baseWorkspaceFields, workspaceReferenceOptionsByTarget],
  );
  const canEditByProjectId = useMemo(() => {
    const next = {} as Record<string, boolean>;
    for (const [projectId, config] of Object.entries(projectConfigByProjectId)) {
      next[projectId] = Boolean(config.canEditWorkItems);
    }
    return next;
  }, [projectConfigByProjectId]);
  const customWorkspaceFields = useMemo(
    () => workspaceFields.filter(isDynamicWorkspaceField),
    [workspaceFields],
  );
  const { columnState, updateColumnState } = useTaskColumnState();
  const taskColumns = useMemo(
    () => buildOrderedTaskColumns(columnState, customWorkspaceFields),
    [columnState, customWorkspaceFields],
  );
  const currentSavedViewConfig = useMemo<TaskSavedViewConfig>(() => ({
    filters: filterConditions.filter((condition) => !condition.locked && filterConditionHasValue(condition)),
    combinator: filterCombinator,
    sort: sortRules,
    group: groupBy,
    columns: columnState.visibility,
    columnOrder: columnState.order,
    viewMode,
    ...(viewMode === "gantt" ? { ganttUnit } : {}),
    ...(viewMode === "calendar" ? { calendarUnit } : {}),
  }), [calendarUnit, columnState.order, columnState.visibility, filterCombinator, filterConditions, ganttUnit, groupBy, sortRules, viewMode]);
  const currentWorkspacePreference = useMemo<TaskWorkspacePreferenceInput>(() => ({
    filters: currentSavedViewConfig.filters,
    combinator: currentSavedViewConfig.combinator,
    sort: currentSavedViewConfig.sort,
    group: currentSavedViewConfig.group,
    columns: currentSavedViewConfig.columns,
    columnOrder: currentSavedViewConfig.columnOrder,
    viewMode: currentSavedViewConfig.viewMode,
    splitHierarchy,
    ganttUnit,
    calendarUnit,
    ganttRangeMode,
    customGanttRange,
    todayBucket,
    filterMyTasks: forceMyTasks ? false : filterMyTasks,
    excludeDone,
  }), [calendarUnit, currentSavedViewConfig, customGanttRange, excludeDone, filterMyTasks, forceMyTasks, ganttRangeMode, ganttUnit, splitHierarchy, todayBucket]);
  const visibleTaskColumns = useMemo(
    () => taskColumns.filter((column) => column.visible),
    [taskColumns],
  );
  const hiddenColumnCount = useMemo(() => countHiddenColumns(taskColumns), [taskColumns]);
  const fieldVisibility = useMemo(() => visibleSystemFieldState(taskColumns), [taskColumns]);
  const visibleCustomFieldIds = useMemo(() => visibleCustomFieldIdSet(taskColumns), [taskColumns]);
  const taskGroupOptions = useMemo(
    () => getTaskGroupOptions({
      customFields: customWorkspaceFields,
      systemLabels: {
        status: messages.taskWorkspace.fieldLabels.status,
        issueType: messages.taskWorkspace.fieldLabels.issueType,
        assignee: messages.taskWorkspace.fieldLabels.assignee,
        project: messages.taskWorkspace.filterFields.project,
      },
    }),
    [customWorkspaceFields, messages.taskWorkspace.fieldLabels, messages.taskWorkspace.filterFields.project],
  );
  const priorityFieldId = baseCustomWorkspaceFields.find((field) => field.key === "priority")?.id ?? null;
  const effectiveGroupBy = groupBy;
  const activeGroupOption = useMemo(
    () => effectiveGroupBy ? taskGroupOptions.find((option) => option.id === effectiveGroupBy) ?? null : null,
    [effectiveGroupBy, taskGroupOptions],
  );
  const activeGroupLabel = activeGroupOption?.label ?? (effectiveGroupBy ? messages.taskWorkspace.groupLabels.removedField : null);
  useEffect(() => {
    if (!workspacePreferenceQuery.isSuccess || !workspacePreferenceQuery.data) return;
    if (preferenceAppliedKeyRef.current === resolvedPreferenceWorkspaceKey) return;
    const preference = workspacePreferenceQuery.data;
    const hasFilterParam = Boolean(searchParams?.has("filter") || searchParams?.has("assignee") || searchParams?.has("cycle"));
    const hasSortParam = searchParams?.has("sort") ?? false;
    const hasGroupParam = searchParams?.has("group") ?? false;
    const needsTodayDefault = todayMode && !preference.exists && !hasGroupParam;
    if (needsTodayDefault && !priorityFieldId && projectConfigLoading) return;

    preferenceAppliedKeyRef.current = resolvedPreferenceWorkspaceKey;
    let legacyColumns: ReturnType<typeof parseTaskColumnState> = null;
    if (!preference.exists && currentUserId && typeof window !== "undefined") {
      const storageKey = taskColumnStorageKey(currentUserId, savedViewsWorkspaceKey);
      legacyColumns = parseTaskColumnState(window.localStorage.getItem(storageKey));
      if (legacyColumns) legacyColumnStorageKeyRef.current = storageKey;
    }

    /* eslint-disable react-hooks/set-state-in-effect */
    if (preference.exists && !hasFilterParam) {
      setFilterConditions((current) => [
        ...current.filter((condition) => condition.locked),
        ...preference.filters.map((condition) => ({
          ...condition,
          id: createFilterId(),
          locked: false,
        })),
      ]);
      setFilterCombinator(preference.combinator);
    }
    if (!hasSortParam) {
      setSortRules(preference.sort.map((rule) => ({ ...rule, id: createFilterId() })));
    }
    if (!hasGroupParam) {
      setGroupBy(needsTodayDefault ? priorityFieldId : preference.group);
    }
    if (preference.exists) {
      setViewMode(preference.viewMode);
      setSplitHierarchy(preference.splitHierarchy);
      setGanttUnit(preference.ganttUnit);
      setCalendarUnit(preference.calendarUnit);
      setGanttRangeMode(preference.ganttRangeMode);
      setCustomGanttRange(preference.customGanttRange);
      setTodayBucket(preference.todayBucket);
      if (!forceMyTasks) setFilterMyTasks(preference.filterMyTasks);
      setExcludeDone(preference.excludeDone);
    }
    if (preference.exists || legacyColumns) {
      const columns = legacyColumns ?? {
        visibility: preference.columns,
        order: preference.columnOrder,
      };
      updateColumnState(() => columns);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [currentUserId, forceMyTasks, priorityFieldId, projectConfigLoading, resolvedPreferenceWorkspaceKey, savedViewsWorkspaceKey, searchParams, todayMode, updateColumnState, workspacePreferenceQuery.data, workspacePreferenceQuery.isSuccess]);

  useEffect(() => {
    if (preferenceAppliedKeyRef.current !== resolvedPreferenceWorkspaceKey) return;
    const timeoutId = window.setTimeout(() => {
      void saveWorkspacePreference(currentWorkspacePreference)
        .then(() => {
          const legacyStorageKey = legacyColumnStorageKeyRef.current;
          if (!legacyStorageKey) return;
          window.localStorage.removeItem(legacyStorageKey);
          legacyColumnStorageKeyRef.current = null;
        })
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [currentWorkspacePreference, resolvedPreferenceWorkspaceKey, saveWorkspacePreference]);
  useEffect(() => {
    if (!cycleIdFromUrl) return;
    const cycleField = workspaceFields.find((field) => field.key === "cycle");
    if (!cycleField) return;
    const canonicalCycleEntityRecordId = cycleIdFromUrl.startsWith("entity-record-cycle-")
      ? cycleIdFromUrl
      : `entity-record-cycle-${cycleIdFromUrl}`;
    const cycleFilterValues = Array.from(new Set([cycleIdFromUrl, canonicalCycleEntityRecordId]));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterConditions((current) => {
      if (current.some((condition) => condition.locked && condition.field === cycleField.id)) return current;
      return [
        ...current,
        {
          id: createFilterId(),
          field: cycleField.id,
          operator: "in",
          value: cycleFilterValues,
          locked: true,
        },
      ];
    });
  }, [cycleIdFromUrl, workspaceFields]);

  const allowedStatusIdsByIssueType = useMemo(() => {
    const next = {} as Record<string, string[]>;

    for (const issueType of issueTypes) {
      const statusIds = issueType.statusSchema?.statuses.map((entry) => entry.status.id) ?? [];
      if (statusIds.length > 0) next[issueType.id] = statusIds;
    }

    for (const query of projectConfigQueries) {
      const perTypeAllowedStatuses = query.data?.perTypeAllowedStatuses;
      if (!perTypeAllowedStatuses) continue;
      Object.assign(next, perTypeAllowedStatuses);
    }

    return next;
  }, [issueTypes, projectConfigQueries]);

  const taskStatusIdList = useMemo(
    () => Array.from(new Set(Object.values(allowedStatusIdsByIssueType).flat())).sort(),
    [allowedStatusIdsByIssueType],
  );
  const taskStatusIdSet = useMemo(() => new Set(taskStatusIdList), [taskStatusIdList]);
  const taskStatusOptions = useMemo(
    () => taskStatusIdSet.size > 0 ? statuses.filter((status) => taskStatusIdSet.has(status.id)) : statuses,
    [statuses, taskStatusIdSet],
  );
  const taskStatusIdKey = taskStatusIdList.join("|");

  useEffect(() => {
    if (!taskStatusIdKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterConditions((current) => sanitizeTaskFilterConditions(current, { validStatusIds: taskStatusIdSet }));
  }, [taskStatusIdKey, taskStatusIdSet]);

  const transitionsByIssueType = useMemo(() => {
    const next = {} as Record<string, { fromStatusId: string; toStatusId: string }[]>;

    for (const issueType of issueTypes) {
      const transitions = issueType.statusSchema?.transitions;
      if (transitions && transitions.length > 0) next[issueType.id] = transitions;
    }

    for (const query of projectConfigQueries) {
      const perTypeTransitions = query.data?.perTypeTransitions;
      if (!perTypeTransitions) continue;
      Object.assign(next, perTypeTransitions);
    }

    return next;
  }, [issueTypes, projectConfigQueries]);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        ganttRangeOpen &&
        !ganttRangePanelRef.current?.contains(target) &&
        !ganttRangeButtonRef.current?.contains(target)
      ) {
        setGanttRangeOpen(false);
      }
      if (
        viewSettingsOpen &&
        !viewSettingsPanelRef.current?.contains(target) &&
        !viewSettingsButtonRef.current?.contains(target)
      ) {
        setViewSettingsOpen(false);
      }
      if (
        viewModeMenuOpen &&
        !viewModeMenuPanelRef.current?.contains(target) &&
        !viewModeMenuButtonRef.current?.contains(target)
      ) {
        setViewModeMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGanttRangeOpen(false);
        setViewSettingsOpen(false);
        setViewModeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ganttRangeOpen, viewModeMenuOpen, viewSettingsOpen]);

  useEffect(() => {
    if (!activeToolPanel) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveToolPanel(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeToolPanel]);

  const isTaskFullscreen = fullscreenView !== null;
  const fullscreenUsesDocumentScroll = fullscreenView === "list" || fullscreenView === "grid" || fullscreenView === "kanban";
  const activeBulkViewMode = fullscreenView ?? effectiveViewMode;
  const bulkSelectionVisible = activeBulkViewMode === "list" || activeBulkViewMode === "grid";

  useEffect(() => {
    if (!isTaskFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const root = document.documentElement;
    const previousTaskFullscreen = root.dataset.taskFullscreen;
    document.body.style.overflow = "hidden";
    root.dataset.taskFullscreen = "true";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setFullscreenView(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousTaskFullscreen) {
        root.dataset.taskFullscreen = previousTaskFullscreen;
      } else {
        delete root.dataset.taskFullscreen;
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTaskFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateWorkspaceViewportHeight = () => {
      const shell = workspaceShellRef.current;
      if (!shell) return;

      const bottomInset = window.innerWidth < 768 ? 96 : 0;
      const nextHeight = Math.max(320, Math.floor(window.innerHeight - shell.getBoundingClientRect().top - bottomInset));
      setWorkspaceViewportHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    updateWorkspaceViewportHeight();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateWorkspaceViewportHeight()) : null;
    resizeObserver?.observe(document.body);
    if (workspaceShellRef.current?.parentElement) {
      resizeObserver?.observe(workspaceShellRef.current.parentElement);
    }

    window.addEventListener("resize", updateWorkspaceViewportHeight);
    return () => {
      window.removeEventListener("resize", updateWorkspaceViewportHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  const filterFieldLabels = messages.taskWorkspace.filterFields;
  const filterFieldPlaceholders = messages.taskWorkspace.filterPlaceholders;
  const filterOperatorLabels: Record<FilterOperator, string> = {
    contains: messages.taskWorkspace.filterOperators.contains,
    not_contains: messages.taskWorkspace.filterOperators.notContains,
    is: messages.taskWorkspace.filterOperators.is,
    is_not: messages.taskWorkspace.filterOperators.isNot,
    on_or_before: messages.taskWorkspace.filterOperators.onOrBefore,
    on_or_after: messages.taskWorkspace.filterOperators.onOrAfter,
    gt: messages.taskWorkspace.filterOperators.gt,
    gte: messages.taskWorkspace.filterOperators.gte,
    lt: messages.taskWorkspace.filterOperators.lt,
    lte: messages.taskWorkspace.filterOperators.lte,
    between: messages.taskWorkspace.filterOperators.between,
    in: messages.taskWorkspace.filterOperators.in,
    not_in: messages.taskWorkspace.filterOperators.notIn,
    is_empty: messages.taskWorkspace.filterOperators.isEmpty,
    is_not_empty: messages.taskWorkspace.filterOperators.isNotEmpty,
  };

  const localizedSortFields: { value: SortFieldKey; label: string }[] = [
    { value: "title", label: messages.taskWorkspace.filterFields.title },
    { value: "startDate", label: messages.taskWorkspace.fieldLabels.startDate },
    { value: "dueDate", label: messages.taskWorkspace.fieldLabels.dueDate },
    { value: "createdAt", label: messages.taskWorkspace.fieldLabels.createdAt },
    { value: "updatedAt", label: messages.taskWorkspace.fieldLabels.updatedAt },
    { value: "status", label: messages.taskWorkspace.fieldLabels.status },
    { value: "issueType", label: messages.taskWorkspace.fieldLabels.issueType },
  ];
  const localizedViewModes: { key: ViewMode; label: string }[] = [
    { key: "list", label: messages.taskWorkspace.viewModes.list },
    { key: "grid", label: messages.taskWorkspace.viewModes.grid },
    { key: "kanban", label: messages.taskWorkspace.viewModes.kanban },
    { key: "gantt", label: messages.taskWorkspace.viewModes.gantt },
    { key: "calendar", label: messages.taskWorkspace.viewModes.calendar },
  ];
  const localizedTodayBuckets: { key: TodayBucket; label: string }[] = [
    { key: "byToday", label: messages.todayView.buckets.byToday },
    { key: "overdue", label: messages.todayView.buckets.overdue },
    { key: "next7", label: messages.todayView.buckets.next7 },
    { key: "unplanned", label: messages.todayView.buckets.unplanned },
    { key: "done", label: messages.todayView.buckets.done },
  ];
  const localizedGanttUnitOptions: { value: GanttDisplayUnit; label: string }[] = [
    { value: "day", label: messages.taskWorkspace.ganttUnits.day },
    { value: "week", label: messages.taskWorkspace.ganttUnits.week },
    { value: "month", label: messages.taskWorkspace.ganttUnits.month },
    { value: "quarter", label: messages.taskWorkspace.ganttUnits.quarter },
  ];
  const getTaskColumnLabel = useCallback((column: TaskWorkspaceColumn) => {
    if (column.kind === "custom") return column.field?.name ?? column.id;
    return messages.taskWorkspace.fieldLabels[column.id as keyof typeof messages.taskWorkspace.fieldLabels] ?? column.id;
  }, [messages]);
  // 필터 가능한 커스텀 필드 = 구성표 합집합의 모든 커스텀 필드(컬럼 표시 여부와 무관).
  const customFilterFields = customWorkspaceFields;
  const customFilterFieldById = useMemo(
    () => new Map(customFilterFields.map((field) => [field.id, field] as const)),
    [customFilterFields],
  );
  const getFilterFieldLabelText = (field: FilterFieldKey) =>
    (filterFieldLabels as Record<string, string>)[field] ?? customFilterFieldById.get(field)?.name ?? field;
  const filterFieldOptions = useMemo<ComboboxOption[]>(
    () => [
      ...FILTER_FIELDS.map((field) => ({ value: field, label: filterFieldLabels[field as keyof typeof filterFieldLabels] })),
      ...customFilterFields.map((field) => ({ value: field.id, label: field.name })),
    ],
    [filterFieldLabels, customFilterFields]
  );
  const assigneeOptions = useMemo<ComboboxOption[]>(() => {
    const next = new Map<string, ComboboxOption>();
    for (const members of projectMembersByProjectId.values()) {
      for (const member of members) {
        next.set(member.id, { value: member.id, label: member.name });
      }
    }
    for (const task of tasks) {
      if (task.assignee) next.set(task.assignee.id, { value: task.assignee.id, label: task.assignee.name });
    }
    return Array.from(next.values());
  }, [projectMembersByProjectId, tasks]);
  const groupUsers = useMemo<UserOption[]>(() => {
    const next = new Map<string, UserOption>();
    for (const members of projectMembersByProjectId.values()) {
      for (const member of members) next.set(member.id, member);
    }
    for (const task of tasks) {
      if (task.assignee) next.set(task.assignee.id, task.assignee);
    }
    return Array.from(next.values());
  }, [projectMembersByProjectId, tasks]);

  const getFilterValueOptions = (field: FilterFieldKey): ComboboxOption[] => {
    if (field === "status") return taskStatusOptions.map((status) => ({ value: status.id, label: status.name, color: status.color }));
    if (field === "issueType") return issueTypes.map((issueType) => ({ value: issueType.id, label: issueType.name, color: issueType.color }));
    if (field === "project") return projects.map((project) => ({ value: project.id, label: `[${project.key}] ${project.name}` }));
    if (field === "assignee") return assigneeOptions;
    // 커스텀 SELECT/MULTI_SELECT/REFERENCE: 구성표 합집합 옵션(value dedupe) + 데이터에 존재하나 옵션엔 없는
    // orphan 값(삭제된 옵션 등)도 선택지로 보강해 스테일 데이터를 필터·정리할 수 있게 한다.
    const custom = customFilterFieldById.get(field);
    if (custom && ["SELECT", "MULTI_SELECT", "REFERENCE", "MULTI_REFERENCE", "OBJECT_REF", "MULTI_OBJECT_REF", "ENTITY_REF", "MULTI_ENTITY_REF", "USER"].includes(custom.type)) {
      const options = custom.options.map((option) => ({ value: option.value, label: option.label, color: option.color, aliases: option.aliases }));
      const orphans = new Set<string>();
      for (const task of tasks) {
        const raw = getTaskCustomFieldValue(task, custom);
        const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        for (const value of values) if (!findReferenceOption(options, value)) orphans.add(value);
      }
      return [...options, ...Array.from(orphans).map((value) => ({ value, label: value }))];
    }
    return [];
  };

  const getFilterConditionSummary = (condition: FilterCondition, valueOptions: ComboboxOption[]) => {
    if (!filterRequiresValue(condition.operator)) return filterOperatorLabels[condition.operator];

    const fieldPlaceholder = filterFieldPlaceholders[condition.field as keyof typeof filterFieldPlaceholders] ?? messages.taskWorkspace.inputValue;
    const summaryKind = getFilterFieldKind(condition.field, customFilterFieldById);
    if (summaryKind === "select" || summaryKind === "multiselect") {
      const values = Array.isArray(condition.value) ? condition.value : condition.value ? [condition.value] : [];
      const selected = Array.from(new Set(
        values
          .map((value) => findReferenceOption(valueOptions, value)?.label)
          .filter((value): value is string => Boolean(value)),
      ));

      if (selected.length === 0) return fieldPlaceholder;
      if (selected.length === 1) return selected[0];
      return messages.taskWorkspace.multiSelectSummary
        .replace("{first}", selected[0]!)
        .replace("{rest}", String(selected.length - 1));
    }

    const stringValue = filterConditionStringValue(condition).trim();
    if (condition.operator === "between" && stringValue && condition.value2?.trim()) {
      return `${stringValue} ${messages.taskWorkspace.filterBetweenSeparator} ${condition.value2.trim()}`;
    }
    return stringValue || fieldPlaceholder;
  };

  const renderFilterValueEditor = ({
    fieldKind,
    operator,
    value,
    value2,
    valueOptions,
    placeholder,
    disabled = false,
    onValueChange,
    onValue2Change,
  }: {
    fieldKind: FilterFieldKind;
    operator: FilterOperator;
    value: string | string[];
    value2?: string;
    valueOptions: ComboboxOption[];
    placeholder: string;
    disabled?: boolean;
    onValueChange: (value: string | string[]) => void;
    onValue2Change?: (value: string) => void;
  }) => {
    const normalizedOperator = normalizeOperatorForKind(operator, fieldKind);
    if (!filterRequiresValue(normalizedOperator)) {
      return (
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-2.5 py-2 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
          {messages.taskWorkspace.filterNoValueRequired}
        </p>
      );
    }

    const isSelectField = fieldKind === "select" || fieldKind === "multiselect";
    const isDateField = fieldKind === "date";
    const isNumberField = fieldKind === "number";
    const isBetween = normalizedOperator === "between";
    const stringValue = Array.isArray(value) ? "" : value;
    const valueArray = Array.isArray(value) ? value : value ? [value] : [];

    if (isSelectField) {
      return (
        <MultiCombobox
          options={valueOptions}
          values={valueArray}
          onChange={(values) => onValueChange(values)}
          className="w-full"
          triggerClassName={panelSelectTriggerClassName}
          placeholder={placeholder}
          dropdownWidth="w-64"
          disabled={disabled}
          renderTrigger={(selected) => {
            const label = selected.length === 0
              ? placeholder
              : selected.length === 1
                ? selected[0]!.label
                : messages.taskWorkspace.multiSelectSummary
                    .replace("{first}", selected[0]!.label)
                    .replace("{rest}", String(selected.length - 1));
            return (
              <>
                <span className={cn("truncate text-left", selected.length > 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]")}>
                  {label}
                </span>
                <ChevronDownIcon className={panelSelectChevronClassName} />
              </>
            );
          }}
        />
      );
    }

    if ((isDateField || isNumberField) && isBetween) {
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
          <Input
            type={isDateField ? "date" : "number"}
            inputSize="sm"
            value={stringValue}
            disabled={disabled}
            onChange={(event) => onValueChange(event.target.value)}
          />
          <span className="px-1 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
            {messages.taskWorkspace.filterBetweenSeparator}
          </span>
          <Input
            type={isDateField ? "date" : "number"}
            inputSize="sm"
            value={value2 ?? ""}
            disabled={disabled}
            onChange={(event) => onValue2Change?.(event.target.value)}
          />
        </div>
      );
    }

    if (isDateField || isNumberField) {
      return (
        <Input
          type={isDateField ? "date" : "number"}
          inputSize="sm"
          value={stringValue}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
        />
      );
    }

    return (
      <input
        type="text"
        value={stringValue}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-xs)] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-accent)] disabled:cursor-not-allowed"
      />
    );
  };

  const activeFilterConditions = useMemo(
    () => filterConditions.filter((condition) => filterConditionHasValue(condition)),
    [filterConditions]
  );
  const lockedFilterConditions = useMemo(
    () => activeFilterConditions.filter((condition) => condition.locked),
    [activeFilterConditions],
  );
  const unlockedFilterConditions = useMemo(
    () => activeFilterConditions.filter((condition) => !condition.locked),
    [activeFilterConditions],
  );
  const showFilterCombinator = unlockedFilterConditions.length >= 2;
  const activeFilterCount = activeFilterConditions.length + (filterMyTasks ? 1 : 0);
  const titleHighlightQuery = useMemo(() => {
    const titleCondition = activeFilterConditions.find((condition) => condition.field === "title" && (condition.operator === "contains" || condition.operator === "is"));
    if (!titleCondition) return "";
    const v = filterConditionStringValue(titleCondition);
    return v.trim();
  }, [activeFilterConditions]);

  const filteredTasks = useMemo(() => {
    const today = todayDateValue();
    const plus7 = addDaysToDateValue(today, 7);
    return tasks.filter((task) => {
      if (filterMyTasks && currentUserId && task.assignee?.id !== currentUserId) return false;
      if (!lockedFilterConditions.every((condition) => matchesFilterCondition(task, condition, customFilterFieldById))) return false;
      if (todayMode) {
        const due = toDateFieldValue(task.dueDate);
        const isDone = task.status.category === "DONE";
        const inBucket = todayBucket === "byToday"
          ? Boolean(due && due <= today)
          : todayBucket === "overdue"
            ? Boolean(due && due < today)
            : todayBucket === "next7"
              ? Boolean(due && due > today && due <= plus7)
              : todayBucket === "unplanned"
                ? !due
                : isDone;
        if (!inBucket) return false;
        if (excludeDone && todayBucket !== "done" && isDone) return false;
      }
      if (unlockedFilterConditions.length === 0) return true;
      return filterCombinator === "AND"
        ? unlockedFilterConditions.every((condition) => matchesFilterCondition(task, condition, customFilterFieldById))
        : unlockedFilterConditions.some((condition) => matchesFilterCondition(task, condition, customFilterFieldById));
    });
  }, [currentUserId, customFilterFieldById, excludeDone, filterCombinator, filterMyTasks, lockedFilterConditions, tasks, todayBucket, todayMode, unlockedFilterConditions]);

  const sortedTasks = useMemo(() => sortItems(filteredTasks, sortRules, locale), [filteredTasks, locale, sortRules]);
  const groupingEnabledForView = effectiveViewMode === "list" || effectiveViewMode === "grid";
  const groupSections = useMemo<TaskGroupSection[] | null>(() => {
    if (!groupingEnabledForView || !activeGroupOption) return null;
    return groupTasks({
      tasks: sortedTasks,
      option: activeGroupOption,
      statuses: taskStatusOptions,
      issueTypes,
      projects,
      users: groupUsers,
      labels: {
        noValue: messages.taskWorkspace.groupLabels.noValue,
        removedField: messages.taskWorkspace.groupLabels.removedField,
      },
    });
  }, [activeGroupOption, groupUsers, groupingEnabledForView, issueTypes, messages.taskWorkspace.groupLabels.noValue, messages.taskWorkspace.groupLabels.removedField, projects, sortedTasks, taskStatusOptions]);
  const groupedDisplayTasks = useMemo(
    () => groupSections ? groupSections.flatMap((section) => section.tasks) : sortedTasks,
    [groupSections, sortedTasks],
  );
  const { displayTasks, depthMap, hasChildrenIds, allChildCountById, childProgressById } = useMemo(
    () => buildHierarchy(groupedDisplayTasks, groupSections ? true : splitHierarchy, collapsedIds),
    [collapsedIds, groupSections, groupedDisplayTasks, splitHierarchy]
  );
  const displayTaskIds = useMemo(() => new Set(displayTasks.map((task) => task.id)), [displayTasks]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBulkSelectedIds((current) => {
      const next = new Set(Array.from(current).filter((id) => displayTaskIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [displayTaskIds]);

  const selectedBulkTasks = useMemo(() => {
    const seen = new Set<string>();
    return displayTasks.filter((task) => {
      if (!bulkSelectedIds.has(task.id) || seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }, [bulkSelectedIds, displayTasks]);

  const selectedBulkTaskIdsKey = useMemo(
    () => selectedBulkTasks.map((task) => task.id).join("|"),
    [selectedBulkTasks],
  );

  const toggleManyBulkSelected = (ids: string[], selected: boolean) => {
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleAllVisibleSelected = (selected: boolean) => {
    setBulkSelectedIds((current) => {
      if (!selected) {
        const next = new Set(current);
        for (const task of displayTasks) next.delete(task.id);
        return next;
      }
      return new Set([...Array.from(current), ...displayTasks.map((task) => task.id)]);
    });
  };

  const clearBulkSelection = () => {
    bulkSelectionAnchorRef.current = null;
    setBulkSelectedIds(new Set());
  };

  const bulkActions = useBulkWorkItemActions({
    selectedTasks: selectedBulkTasks,
    onClearSelection: clearBulkSelection,
    onRefresh,
    onDone: () => {
      setActiveToolPanel(null);
      setContextMenu(null);
      setBulkDeleteConfirmOpen(false);
    },
  });

  useEffect(() => {
    if (activeToolPanel !== "bulk") return;
    if (bulkSelectionVisible && selectedBulkTasks.length > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveToolPanel(null);
  }, [activeToolPanel, bulkSelectionVisible, selectedBulkTasks.length]);

  useEffect(() => {
    if (!filterUrlSyncedRef.current) {
      filterUrlSyncedRef.current = true;
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const serializedFilters = serializeTaskFilters(filterConditions);
    const serializedSort = serializeTaskSort(sortRules);

    if (serializedFilters) {
      params.set("filter", serializedFilters);
      params.set("combinator", filterCombinator);
    } else {
      params.delete("filter");
      params.delete("combinator");
    }

    if (serializedSort) {
      params.set("sort", serializedSort);
    } else {
      params.delete("sort");
    }

    if (groupBy) {
      params.set("group", groupBy);
    } else {
      params.delete("group");
    }

    if (activeViewId && cleanAppliedViewIdRef.current !== activeViewId) {
      params.set("view", activeViewId);
    } else {
      params.delete("view");
    }

    const currentQuery = searchParams?.toString() ?? "";
    const nextQuery = params.toString();
    if (nextQuery === currentQuery) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [activeViewId, filterCombinator, filterConditions, groupBy, pathname, router, searchParams, sortRules]);

  const activeSelectedTask = useMemo(
    () => selectedTask ? tasks.find((task) => task.id === selectedTask.id) ?? selectedTask : null,
    [selectedTask, tasks]
  );

  // Auto-open the detail panel when the URL carries `?task=ID` — used by
  // notification deep links (render.ts:80) and issue mention chips. The URL is
  // an external-source-of-truth that legitimately drives React state here;
  // suppressing `set-state-in-effect` is intentional (no cascading render — the
  // early-return guards ensure the effect is idempotent per URL/tasks snapshot).
  useEffect(() => {
    if (!taskIdFromUrl) return;
    if (selectedTask?.id === taskIdFromUrl) return;
    const match = tasks.find((t) => t.id === taskIdFromUrl);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match) setSelectedTask(match);
  }, [taskIdFromUrl, tasks, selectedTask?.id]);

  // Strip `task` from the URL without adding a history entry.
  const clearTaskQueryParam = () => {
    if (!taskIdFromUrl) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("task");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const openEditModal = (task: WorkItemWithRelations, targetIssueTypeId?: string) => {
    setEditModalState({ task, targetIssueTypeId });
  };

  const handleTaskUpdate = (id: string, data: WorkItemUpdate) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    if (data.issueTypeId) {
      openEditModal(task, data.issueTypeId);
      return;
    }
    if (data.fieldValues && taskHasMissingRequiredSchemaFields(task, issueTypes)) {
      openEditModal(task);
      return;
    }
    onUpdate(id, data);
  };

  const handleSelectTask = (task: WorkItemWithRelations) => {
    setSelectedTask(task);
    setContextMenu(null);
  };

  const handleCommentClick = (task: WorkItemWithRelations) => {
    panelScrollRequestIdRef.current += 1;
    setSelectedTask(task);
    setPanelScrollRequest({ taskId: task.id, target: "comments", requestId: panelScrollRequestIdRef.current });
  };

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateFilterCondition = (id: string, updater: (condition: FilterCondition) => FilterCondition) => {
    setFilterConditions((current) => current.map((condition) => condition.id === id ? updater(condition) : condition));
  };

  const resetFilterDraft = () => {
    setFilterDraftField("");
    setFilterDraftOperator("contains");
    setFilterDraftValue("");
    setFilterDraftValue2("");
  };

  const selectFilterDraftField = (field: FilterFieldKey | "") => {
    if (!field) {
      resetFilterDraft();
      return;
    }
    const next = createFilterCondition(field, getFilterFieldKind(field, customFilterFieldById));
    setFilterDraftField(field);
    setFilterDraftOperator(next.operator);
    setFilterDraftValue(next.value);
    setFilterDraftValue2(next.value2 ?? "");
  };

  const updateFilterDraftOperator = (operator: FilterOperator) => {
    if (!filterDraftField) return;
    const fieldKind = getFilterFieldKind(filterDraftField, customFilterFieldById);
    const normalized = normalizeOperatorForKind(operator, fieldKind);
    setFilterDraftOperator(normalized);
    if (!filterRequiresValue(normalized)) {
      setFilterDraftValue(fieldKind === "select" || fieldKind === "multiselect" ? [] : "");
      setFilterDraftValue2("");
      return;
    }
    if (fieldKind === "select" || fieldKind === "multiselect") {
      setFilterDraftValue((current) => Array.isArray(current) ? current : current ? [current] : []);
    } else {
      setFilterDraftValue((current) => Array.isArray(current) ? "" : current);
    }
    if (normalized !== "between") setFilterDraftValue2("");
  };

  const filterDraftKind = filterDraftField ? getFilterFieldKind(filterDraftField, customFilterFieldById) : "text";
  const normalizedFilterDraftOperator = normalizeOperatorForKind(filterDraftOperator, filterDraftKind);
  const canAddFilterDraft = Boolean(
    filterDraftField && filterConditionHasValue({
      id: "draft",
      field: filterDraftField,
      operator: normalizedFilterDraftOperator,
      value: filterDraftValue,
      value2: filterDraftValue2,
    }),
  );

  const addFilterDraftCondition = () => {
    if (!filterDraftField || !canAddFilterDraft) return;
    setFilterConditions((current) => [
      ...current,
      {
        id: createFilterId(),
        field: filterDraftField,
        operator: normalizedFilterDraftOperator,
        value: filterDraftValue,
        value2: normalizedFilterDraftOperator === "between" ? filterDraftValue2 : undefined,
      },
    ]);
    resetFilterDraft();
  };

  const removeFilterCondition = (id: string) => {
    setFilterConditions((current) => current.filter((condition) => condition.id !== id));
  };

  const resetFilters = () => {
    setFilterConditions((current) => {
      const locked = current.filter((c) => c.locked);
      return locked;
    });
    setFilterCombinator("AND");
    setFilterMyTasks(false);
    resetFilterDraft();
  };

  const addSortRule = () => {
    setSortRules((current) => {
      const used = new Set(current.map((rule) => rule.field));
      const firstUnused = SORT_FIELDS.find((field) => !used.has(field));
      return firstUnused ? [...current, createSortRule(firstUnused)] : current;
    });
  };

  const updateSortRule = (id: string, patch: Partial<Omit<SortRule, "id">>) => {
    setSortRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  };

  const removeSortRule = (id: string) => {
    setSortRules((current) => current.filter((rule) => rule.id !== id));
  };

  const moveSortRule = (id: string, offset: -1 | 1) => {
    setSortRules((current) => {
      const index = current.findIndex((rule) => rule.id === id);
      const targetIndex = index + offset;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [rule] = next.splice(index, 1);
      next.splice(targetIndex, 0, rule!);
      return next;
    });
  };

  const autoGanttRange = useMemo(() => resolveAutoGanttRange(displayTasks), [displayTasks]);
  const resolvedGanttRange = useMemo(() => {
    const base = ganttRangeMode === "custom"
      ? {
          start: customGanttRange.start || autoGanttRange.start,
          end: customGanttRange.end || autoGanttRange.end,
        }
      : autoGanttRange;

    return base.start <= base.end ? base : { start: base.end, end: base.start };
  }, [autoGanttRange, customGanttRange.end, customGanttRange.start, ganttRangeMode]);

  const handleColumnWidthChange = (column: TaskColumnKey, width: number) => {
    setColumnWidths((current) => ({ ...current, [column]: width }));
  };

  const handleTaskContextMenu = (task: WorkItemWithRelations, event: React.MouseEvent) => {
    event.preventDefault();
    const position = { x: event.clientX, y: event.clientY };

    if (bulkSelectionVisible) {
      if (bulkSelectedIds.has(task.id) && bulkSelectedIds.size >= 2) {
        setContextMenu({ kind: "bulk", ...position });
        return;
      }

      if (!bulkSelectedIds.has(task.id)) {
        bulkSelectionAnchorRef.current = task.id;
        setBulkSelectedIds(new Set([task.id]));
      }
    }

    setContextMenu({ kind: "single", task, ...position });
  };

  const handleQuickCreateTask = (taskTitle: string) => {
    if (!onCreateTask) return;
    const resolvedProjectId = workspaceProjectId ?? defaultCreateProjectId;
    // 그룹 뷰 등 프로젝트 컨텍스트가 없는 화면에서는 즉시 생성 대신 모달을 열어
    // 사용자가 프로젝트·기타 필드를 선택하도록 한다. 이미 입력한 제목은 prefill.
    if (!resolvedProjectId) {
      setCreateTaskPreset({ title: taskTitle });
      return;
    }
    // 기본 이슈 유형에 빠른 생성으로 자동 충족할 수 없는 필수 필드(기본값 없는 커스텀 필수,
    // 또는 필수 설명/일정)가 있으면, 즉시 생성 대신 제목을 채운 생성 모달을 연다.
    const config = projectConfigByProjectId[resolvedProjectId];
    const defaultIssueType = config
      ? config.enabledIssueTypes.find((issueType) => issueType.id === config.defaultIssueTypeId)
        ?? config.enabledIssueTypes[0]
        ?? null
      : null;
    if (defaultIssueType && !canQuickCreateSatisfyRequiredFields(defaultIssueType)) {
      setCreateTaskPreset({ title: taskTitle });
      return;
    }
    onCreateTask({
      title: taskTitle,
      projectId: resolvedProjectId,
    });
  };

  const handleCreateTaskAtDate = (date: string) => {
    setCreateTaskPreset({ startDate: date, dueDate: date });
  };

  const handleCalendarSelectDate = (date: string) => {
    setCalendarUnit("day");
    setCalendarAnchorDate(date);
  };

  const closeFloatingPanels = () => {
    setActiveToolPanel(null);
    setGanttRangeOpen(false);
    setViewSettingsOpen(false);
  };

  const handleToolPanelToggle = (panel: TaskToolPanel) => {
    setGanttRangeOpen(false);
    setViewSettingsOpen(false);
    setActiveToolPanel((current) => current === panel ? null : panel);
  };

  const openBulkPanel = (tab: BulkPanelTab) => {
    setGanttRangeOpen(false);
    setContextMenu(null);
    setBulkPanelTab(tab);
    setActiveToolPanel("bulk");
  };

  const requestBulkDelete = () => {
    if (selectedBulkTasks.length === 0 || selectedBulkTasks.length > BULK_WORK_ITEM_ACTION_LIMIT) return;
    setContextMenu(null);
    setBulkDeleteConfirmOpen(true);
  };

  const closeActivePanel = () => {
    setActiveToolPanel(null);
  };

  const closeFullscreenView = () => {
    setFullscreenView(null);
  };

  const prepareGanttRangeDraft = useCallback(() => {
    setGanttRangeDraft(ganttRangeMode === "custom"
      ? { start: customGanttRange.start || resolvedGanttRange.start, end: customGanttRange.end || resolvedGanttRange.end }
      : resolvedGanttRange);
  }, [customGanttRange.end, customGanttRange.start, ganttRangeMode, resolvedGanttRange]);

  const updateViewMode = useCallback((nextMode: ViewMode) => {
    setViewMode(nextMode);
    if (nextMode === "gantt") {
      prepareGanttRangeDraft();
    } else {
      setGanttRangeOpen(false);
    }
    setViewSettingsOpen(false);
    if (nextMode !== "list" && nextMode !== "grid") {
      setActiveToolPanel((current) => current === "group" ? null : current);
    }
  }, [prepareGanttRangeDraft]);

  const openFullscreenView = (nextView: FullscreenView) => {
    setSelectedTask(null);
    setPanelScrollRequest(null);
    setContextMenu(null);
    closeFloatingPanels();
    updateViewMode(nextView);
    setFullscreenView(nextView);
  };

  const applyGanttRange = () => {
    if (!ganttRangeDraft.start || !ganttRangeDraft.end) return;
    setGanttRangeMode("custom");
    setCustomGanttRange({ start: ganttRangeDraft.start, end: ganttRangeDraft.end });
    setGanttRangeOpen(false);
  };

  const resetGanttRange = () => {
    setGanttRangeMode("auto");
    setCustomGanttRange({ start: "", end: "" });
    setGanttRangeDraft({ start: "", end: "" });
    setGanttRangeOpen(false);
  };

  const applySavedView = useCallback((view: TaskSavedViewDto, options?: { cleanUrl?: boolean }) => {
    const config = normalizeTaskSavedViewConfig(view.config);
    setFilterConditions((current) => [
      ...current.filter((condition) => condition.locked),
      ...config.filters.map((condition) => ({
        ...condition,
        id: createFilterId(),
        locked: false,
      })),
    ]);
    setFilterCombinator(config.combinator);
    setSortRules(config.sort.map((rule) => ({ ...rule, id: createFilterId() })));
    setGroupBy(config.group);
    updateColumnState((current) => ({
      visibility: { ...current.visibility, ...config.columns },
      order: normalizeColumnOrder(taskColumns.map((column) => column.id), config.columnOrder),
    }));
    updateViewMode(config.viewMode);
    if (config.ganttUnit) setGanttUnit(config.ganttUnit);
    if (config.calendarUnit) setCalendarUnit(config.calendarUnit);
    cleanAppliedViewIdRef.current = options?.cleanUrl ? view.id : null;
    setActiveViewId(view.id);
    setActiveToolPanel(null);
    setGanttRangeOpen(false);
  }, [taskColumns, updateColumnState, updateViewMode]);

  const clearActiveSavedView = useCallback(() => {
    cleanAppliedViewIdRef.current = null;
    setActiveViewId(null);
  }, []);

  useEffect(() => {
    const urlViewId = searchParams?.get("view") ?? null;
    if (!urlViewId || urlViewAppliedRef.current === urlViewId) return;
    const view = savedViewsData.views.find((item) => item.id === urlViewId);
    if (!view) return;
    urlViewAppliedRef.current = urlViewId;
    // URL `?view=` is an external source of truth for restoring saved workspace state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    applySavedView(view);
  }, [applySavedView, savedViewsData.views, searchParams]);

  useEffect(() => {
    if (!currentUserId || defaultSavedViewAppliedRef.current || !savedViewsQuery.data || savedViewsQuery.isLoading) return;
    defaultSavedViewAppliedRef.current = true;
    const hasExplicitViewState = Boolean(
      searchParams?.get("view") ||
      searchParams?.get("filter") ||
      searchParams?.get("sort") ||
      searchParams?.get("group")
    );
    if (hasExplicitViewState || !savedViewsQuery.data.defaultViewId) return;
    const view = savedViewsQuery.data.views.find((item) => item.id === savedViewsQuery.data?.defaultViewId);
    if (view) {
      // The default saved view is server-backed workspace state intentionally applied on first load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applySavedView(view, { cleanUrl: true });
    }
  }, [applySavedView, currentUserId, savedViewsQuery.data, savedViewsQuery.isLoading, searchParams]);

  const openGanttRangePopover = () => {
    prepareGanttRangeDraft();
    setActiveToolPanel(null);
    setGanttRangeOpen((current) => !current);
  };

  const renderSortSection = ({ showHeader = true }: { showHeader?: boolean } = {}) => (
    <div>
      {showHeader && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="inline-flex min-w-0 items-center gap-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">
            <SortIcon className="h-3.5 w-3.5" />
            <span className="truncate">{messages.taskWorkspace.sort}</span>
          </p>
          <button
            type="button"
            onClick={() => setSortRules([])}
            disabled={sortRules.length === 0}
            className="text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {messages.taskWorkspace.sortBuilder.clearAll}
          </button>
        </div>
      )}

      {sortRules.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-3 text-center text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
          {messages.taskWorkspace.sortBuilder.noRules}
        </div>
      ) : (
        <div className="space-y-2">
          {sortRules.map((rule, index) => {
            const sortFieldOptions = localizedSortFields.filter((field) => (
              field.value === rule.field || !sortRules.some((other) => other.id !== rule.id && other.field === field.value)
            ));
            return (
            <div key={rule.id} className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] p-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center" data-sort-rule="true">
              <span className="text-[length:var(--text-3xs)] font-semibold uppercase text-[var(--color-text-tertiary)] sm:w-10">
                {index === 0 ? messages.taskWorkspace.sortBuilder.primary : messages.taskWorkspace.sortBuilder.secondary}
              </span>
              <Combobox
                options={sortFieldOptions}
                value={rule.field}
                onChange={(value) => updateSortRule(rule.id, { field: value as SortFieldKey })}
                className="min-w-0 w-full"
                triggerClassName={panelSelectTriggerClassName}
                dropdownWidth="w-52"
                renderTrigger={(option) => (
                  <>
                    <span className="truncate">{option?.label ?? localizedSortFields.find((field) => field.value === rule.field)?.label}</span>
                    <ChevronDownIcon className={panelSelectChevronClassName} />
                  </>
                )}
              />
              <div className="inline-flex h-9 w-fit shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-xs)]">
                {(["asc", "desc"] as SortDirection[]).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => updateSortRule(rule.id, { direction })}
                    className={cn(
                      "min-w-10 px-2 text-[length:var(--text-2xs)] transition-colors",
                      direction === "desc" && "border-l border-[var(--color-border)]",
                      rule.direction === direction
                        ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                    )}
                  >
                    {direction === "asc" ? messages.taskWorkspace.sortBuilder.ascending : messages.taskWorkspace.sortBuilder.descending}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 justify-self-start sm:justify-self-end">
                <button type="button" onClick={() => moveSortRule(rule.id, -1)} disabled={index === 0} className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-30" aria-label={messages.taskWorkspace.sortBuilder.moveUp}>
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveSortRule(rule.id, 1)} disabled={index === sortRules.length - 1} className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-30" aria-label={messages.taskWorkspace.sortBuilder.moveDown}>
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => removeSortRule(rule.id)} className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-tertiary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]" aria-label={messages.taskWorkspace.sortBuilder.removeRule}>
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addSortRule}
        disabled={sortRules.length >= SORT_FIELDS.length}
        className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] text-[length:var(--text-xs)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        + {sortRules.length >= SORT_FIELDS.length ? messages.taskWorkspace.sortBuilder.allFieldsUsed : messages.taskWorkspace.sortBuilder.addRule}
      </button>
    </div>
  );

  const renderUnitSegments = (activeUnit: GanttDisplayUnit, onChange: (unit: GanttDisplayUnit) => void) => (
    <div className="inline-flex h-9 max-w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)] p-0.5">
      {localizedGanttUnitOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "min-w-0 px-3 text-[length:var(--text-xs)] transition-colors",
            activeUnit === option.value
              ? "rounded-full bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-[var(--shadow-xs)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );

  const renderGanttRangePopover = () => (
    <FloatingPortal
      open={ganttRangeOpen && viewMode === "gantt"}
      anchorRef={ganttRangeButtonRef}
      floatingRef={ganttRangePanelRef}
      placement="bottom"
      align="end"
      offset={4}
      preferredWidth={360}
      maxHeight={360}
      zIndex={130}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 shadow-[var(--shadow-md)]"
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">{messages.taskWorkspace.period}</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input type="date" value={ganttRangeDraft.start} onChange={(event) => setGanttRangeDraft((current) => ({ ...current, start: event.target.value }))} className="h-9" />
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">~</span>
            <Input type="date" value={ganttRangeDraft.end} onChange={(event) => setGanttRangeDraft((current) => ({ ...current, end: event.target.value }))} className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">{messages.taskWorkspace.currentRange}</span>
          <span className="text-center text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">:</span>
          <span className="text-right text-[length:var(--text-2xs)] text-[var(--color-text-primary)]">{resolvedGanttRange.start} ~ {resolvedGanttRange.end}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={resetGanttRange} className="text-[length:var(--text-xs)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">
            {messages.common.reset}
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setGanttRangeOpen(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" size="sm" onClick={applyGanttRange} disabled={!ganttRangeDraft.start || !ganttRangeDraft.end}>
              {messages.common.confirm}
            </Button>
          </div>
        </div>
      </div>
    </FloatingPortal>
  );

  const renderViewModeSegments = (compact = false) => (
    <div
      className={cn(
        "inline-flex h-9 max-w-full shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-secondary)] p-0.5",
        compact && "h-8"
      )}
      data-task-view-mode-segmented="true"
    >
      {localizedViewModes.map((mode) => (
        <button
          key={mode.key}
          type="button"
          aria-label={mode.label}
          title={mode.label}
          aria-pressed={viewMode === mode.key}
          onClick={() => {
            closeFullscreenView();
            updateViewMode(mode.key);
          }}
          className={cn(
            "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full text-[length:var(--text-xs)] transition-colors",
            compact
              ? "h-7 w-7 px-0"
              : viewMode === mode.key
                ? "h-8 w-auto max-w-[4.5rem] px-2 max-[359px]:h-7 max-[359px]:max-w-[3.5rem] max-[359px]:gap-1 max-[359px]:px-1.5 sm:max-w-[5.5rem] 2xl:max-w-none 2xl:px-2.5"
                : "h-8 w-7 px-0 max-[359px]:h-7 max-[359px]:w-6 sm:w-8 2xl:w-auto 2xl:px-2.5",
            viewMode === mode.key
              ? "bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-[var(--shadow-xs)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <TaskViewIcon mode={mode.key} className="h-3.5 w-3.5 shrink-0" />
          {!compact && <span className={cn("truncate", viewMode === mode.key ? "inline" : "hidden 2xl:inline")}>{mode.label}</span>}
        </button>
      ))}
    </div>
  );

  const renderTodayControls = () => (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1.5" data-today-toolbar-controls="true">
      {!forceMyTasks && currentUserId && (
        <button
          type="button"
          aria-label={messages.todayView.onlyMyTasks}
          title={messages.todayView.onlyMyTasks}
          aria-pressed={filterMyTasks}
          onClick={() => setFilterMyTasks((current) => !current)}
          className={cn(featureToolbarButtonClass, filterMyTasks && featureToolbarButtonActiveClass)}
        >
          <UserIcon className="h-3.5 w-3.5" />
          <span className={featureToolbarResponsiveLabelClass}>{messages.todayView.onlyMyTasks}</span>
        </button>
      )}
      {todayBucket !== "done" && (
        <button
          type="button"
          aria-label={messages.todayView.excludeDone}
          title={messages.todayView.excludeDone}
          aria-pressed={excludeDone}
          onClick={() => setExcludeDone((current) => !current)}
          className={cn(featureToolbarButtonClass, excludeDone && featureToolbarButtonActiveClass)}
        >
          <EyeOffIcon className="h-3.5 w-3.5" />
          <span className={featureToolbarResponsiveLabelClass}>{messages.todayView.excludeDone}</span>
        </button>
      )}
      <button
        type="button"
        aria-label={messages.taskWorkspace.sort}
        title={messages.taskWorkspace.sort}
        onClick={() => handleToolPanelToggle("sort")}
        className={cn(featureToolbarButtonClass, activeToolPanel === "sort" && featureToolbarButtonActiveClass)}
      >
        <SortIcon className="h-3.5 w-3.5" />
        <span className={featureToolbarResponsiveLabelClass}>{messages.taskWorkspace.sort}</span>
        {sortRules.length > 0 && <span className={featureToolbarBadgeClass}>{sortRules.length}</span>}
      </button>
      <button
        type="button"
        aria-label={messages.taskWorkspace.group}
        title={messages.taskWorkspace.group}
        onClick={() => handleToolPanelToggle("group")}
        className={cn(featureToolbarButtonClass, activeToolPanel === "group" && featureToolbarButtonActiveClass)}
      >
        <GroupIcon className="h-3.5 w-3.5" />
        <span className={featureToolbarResponsiveLabelClass}>{messages.taskWorkspace.group}</span>
        {groupBy && <span className={featureToolbarBadgeClass}>1</span>}
      </button>
      <div
        data-today-bucket-scroll="true"
        className="ml-auto min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className={cn(featureToolbarSegmentedClass, "w-max min-w-max")} data-today-bucket-segmented="true">
          {localizedTodayBuckets.map((bucket) => (
            <button
              key={bucket.key}
              type="button"
              aria-pressed={todayBucket === bucket.key}
              onClick={() => setTodayBucket(bucket.key)}
              className={cn(
                featureToolbarSegmentButtonClass,
                "whitespace-nowrap !px-2 @[48rem]/toolbar-controls:!px-3",
                todayBucket === bucket.key
                  ? "bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-[var(--shadow-xs)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {bucket.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMobileViewModeSelector = () => {
    const activeMode = localizedViewModes.find((mode) => mode.key === viewMode) ?? localizedViewModes[0];
    if (!activeMode) return null;

    return (
      <>
        <button
          ref={viewModeMenuButtonRef}
          type="button"
          data-task-view-mode-menu-trigger="true"
          aria-label={messages.taskWorkspace.viewModesLabel}
          title={activeMode.label}
          aria-expanded={viewModeMenuOpen}
          onClick={() => {
            setActiveToolPanel(null);
            setGanttRangeOpen(false);
            setViewSettingsOpen(false);
            setViewModeMenuOpen((current) => !current);
          }}
          className={cn(
            featureToolbarButtonClass,
            featureToolbarButtonActiveClass,
            "h-9 min-w-0 max-w-[4.25rem] shrink gap-1 px-2 text-[length:var(--text-xs)] lg:hidden max-[359px]:h-8 max-[359px]:max-w-[3.25rem] max-[359px]:px-1.5"
          )}
        >
          <TaskViewIcon mode={activeMode.key} className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{activeMode.label}</span>
        </button>

        <FloatingPortal
          open={viewModeMenuOpen}
          anchorRef={viewModeMenuButtonRef}
          floatingRef={viewModeMenuPanelRef}
          placement="bottom"
          align="start"
          offset={4}
          preferredWidth={180}
          maxHeight={320}
          zIndex={140}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1.5 shadow-[var(--shadow-md)]"
        >
          <div data-task-view-mode-menu="true" className="grid gap-1">
            {localizedViewModes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                aria-label={mode.label}
                aria-pressed={viewMode === mode.key}
                onClick={() => {
                  closeFullscreenView();
                  updateViewMode(mode.key);
                  setViewModeMenuOpen(false);
                }}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-left text-[length:var(--text-xs)] transition-colors",
                  viewMode === mode.key
                    ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <TaskViewIcon mode={mode.key} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{mode.label}</span>
              </button>
            ))}
          </div>
        </FloatingPortal>
      </>
    );
  };

  const renderViewContextControls = (compact = false) => {
    const canToggleHierarchy = viewMode === "list" || viewMode === "grid" || viewMode === "gantt";
    return (
      <>
        <button
          type="button"
          aria-label={messages.taskWorkspace.fullscreen}
          title={messages.taskWorkspace.fullscreen}
          onClick={() => openFullscreenView(viewMode)}
          className={cn(featureToolbarButtonClass, compact && "px-2")}
        >
          <FullscreenIcon className="h-3.5 w-3.5" />
          {!compact && <span className={featureToolbarLabelClass}>{messages.taskWorkspace.fullscreen}</span>}
        </button>
        {canToggleHierarchy && (
          <button
            type="button"
            aria-label={splitHierarchy ? messages.taskWorkspace.unsplitHierarchy : messages.taskWorkspace.splitHierarchy}
            title={splitHierarchy ? messages.taskWorkspace.unsplitHierarchy : messages.taskWorkspace.splitHierarchy}
            onClick={() => setSplitHierarchy((current) => !current)}
            disabled={Boolean(groupSections)}
            className={cn(
              featureToolbarButtonClass,
              splitHierarchy
                ? featureToolbarButtonActiveClass
                : "disabled:cursor-not-allowed disabled:opacity-40",
              compact && "px-2"
            )}
          >
            <HierarchyIcon className="h-3.5 w-3.5" />
            {!compact && <span className={featureToolbarLabelClass}>{splitHierarchy ? messages.taskWorkspace.unsplitHierarchy : messages.taskWorkspace.splitHierarchy}</span>}
          </button>
        )}
        {viewMode === "calendar" && (
          renderUnitSegments(calendarUnit, setCalendarUnit)
        )}
        {viewMode === "gantt" && (
          <>
            {renderUnitSegments(ganttUnit, setGanttUnit)}
            <button
              ref={ganttRangeButtonRef}
              type="button"
              aria-label={messages.taskWorkspace.period}
              title={messages.taskWorkspace.period}
              onClick={openGanttRangePopover}
              className={cn(featureToolbarButtonClass, ganttRangeOpen && featureToolbarButtonActiveClass, compact && "px-2")}
            >
              <span className={featureToolbarLabelClass}>{messages.taskWorkspace.period}</span>
            </button>
            {renderGanttRangePopover()}
          </>
        )}
      </>
    );
  };

  const renderToolbarViewSettings = (compact = false) => {
    const viewSettingsBadgeCount =
      (hiddenColumnCount > 0 ? 1 : 0) +
      (activeGroupLabel ? 1 : 0) +
      (splitHierarchy ? 1 : 0) +
      (ganttRangeMode === "custom" ? 1 : 0) +
      (viewMode === "gantt" && ganttUnit !== "month" ? 1 : 0) +
      (viewMode === "calendar" && calendarUnit !== "month" ? 1 : 0);
    const optionButtonClass =
      "flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 text-left text-[length:var(--text-xs)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

    return (
      <>
        <button
          ref={viewSettingsButtonRef}
          type="button"
          aria-label={messages.taskWorkspace.viewSettings}
          title={messages.taskWorkspace.viewSettings}
          onClick={() => {
            setActiveToolPanel(null);
            setGanttRangeOpen(false);
            setViewSettingsOpen((current) => !current);
          }}
          className={cn(
            featureToolbarButtonClass,
            viewSettingsOpen && featureToolbarButtonActiveClass,
            compact && "px-2",
            "max-[767px]:h-9 max-[767px]:min-w-[4rem] max-[767px]:max-w-[5.5rem] max-[767px]:gap-1 max-[767px]:px-2 max-[767px]:text-[length:var(--text-xs)] max-[359px]:h-8 max-[359px]:px-1.5"
          )}
        >
          <MenuIcon className="h-3.5 w-3.5" />
          {!compact && <span className="max-w-14 truncate max-[767px]:max-w-12 sm:max-w-none">{messages.taskWorkspace.viewSettings}</span>}
          {viewSettingsBadgeCount > 0 && (
            <span className={featureToolbarBadgeClass}>{viewSettingsBadgeCount}</span>
          )}
        </button>

        <FloatingPortal
          open={viewSettingsOpen}
          anchorRef={viewSettingsButtonRef}
          floatingRef={viewSettingsPanelRef}
          placement="bottom"
          align="end"
          offset={4}
          preferredWidth={340}
          maxHeight={460}
          zIndex={135}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 shadow-[var(--shadow-md)]"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 pb-2">
              <p className="text-[length:var(--text-xs)] font-semibold text-[var(--color-text-primary)]">
                {messages.taskWorkspace.viewSettings}
              </p>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleToolPanelToggle("columns")}
                className={cn(optionButtonClass, activeToolPanel === "columns" && featureToolbarButtonActiveClass)}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <FieldsIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{messages.taskWorkspace.columns}</span>
                </span>
                {hiddenColumnCount > 0 && (
                  <span className={featureToolbarBadgeClass}>{hiddenColumnCount}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleToolPanelToggle("group")}
                disabled={!groupingEnabledForView}
                className={cn(optionButtonClass, activeToolPanel === "group" && featureToolbarButtonActiveClass)}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{messages.taskWorkspace.group}</span>
                </span>
                {activeGroupLabel && (
                  <span className="max-w-32 truncate rounded-full bg-[var(--color-accent-light)] px-1.5 text-[length:var(--text-3xs)] text-[var(--color-accent)]">
                    {activeGroupLabel}
                  </span>
                )}
              </button>
            </div>

            <div className="space-y-2 border-t border-[var(--color-border)] px-1 pt-3">
              <p className="px-1 text-[length:var(--text-2xs)] font-semibold text-[var(--color-text-secondary)]">
                {messages.taskWorkspace.viewModesLabel}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {renderViewContextControls()}
              </div>
            </div>
          </div>
        </FloatingPortal>
      </>
    );
  };

  const renderAppliedStateChips = () => {
    const showExcludeDoneChip = todayMode && excludeDone && todayBucket !== "done";
    const hasChips = activeFilterConditions.length > 0 || filterMyTasks || showExcludeDoneChip || sortRules.length > 0 || Boolean(groupBy);
    if (!hasChips) return null;

    return (
      <div
        data-task-applied-state-chips="true"
        className={cn(
          "flex flex-wrap items-center gap-2 px-1 pb-1 pt-2",
          !todayMode && "hidden md:flex",
        )}
      >
        {filterMyTasks && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-light)] px-2.5 py-1 text-[length:var(--text-2xs)] text-[var(--color-accent)]">
            <span className="font-medium">{messages.taskWorkspace.onlyMyTasks}</span>
            {!forceMyTasks && (
              <button
                type="button"
                onClick={() => setFilterMyTasks(false)}
                className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[var(--color-accent)]/70 transition-colors hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-danger)]"
                aria-label={messages.taskWorkspace.removeFilter}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </span>
        )}

        {showExcludeDoneChip && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-light)] px-2.5 py-1 text-[length:var(--text-2xs)] text-[var(--color-accent)]">
            <span className="font-medium">{messages.todayView.excludeDone}</span>
            <button
              type="button"
              onClick={() => setExcludeDone(false)}
              className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[var(--color-accent)]/70 transition-colors hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-danger)]"
              aria-label={messages.taskWorkspace.removeFilter}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        )}

        {activeFilterConditions.map((condition) => {
          const valueOptions = getFilterValueOptions(condition.field);
          const fieldKind = getFilterFieldKind(condition.field, customFilterFieldById);
          const normalizedOperator = normalizeOperatorForKind(condition.operator, fieldKind);
          const locked = condition.locked === true;
          return (
            <span
              key={condition.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--text-2xs)]",
                locked
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]",
              )}
              title={locked ? messages.taskWorkspace.filterMyTaskLockedHint : undefined}
            >
              <span className="font-medium">
                {locked ? `${messages.taskWorkspace.lockedFilterPrefix} ` : ""}{getFilterFieldLabelText(condition.field)}
              </span>
              <span className={locked ? "text-[var(--color-accent)]/70" : "text-[var(--color-text-tertiary)]"}>
                {filterOperatorLabels[normalizedOperator]}
              </span>
              <span className="max-w-[14rem] truncate">{getFilterConditionSummary(condition, valueOptions)}</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => removeFilterCondition(condition.id)}
                  className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-black/[0.06] hover:text-[var(--color-danger)]"
                  aria-label={messages.taskWorkspace.removeFilter}
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}

        {groupBy && (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-primary)]">
            <span className="font-medium">{messages.taskWorkspace.group}</span>
            <span className="max-w-[14rem] truncate">{activeGroupLabel ?? messages.taskWorkspace.groupLabels.removedField}</span>
            <button
              type="button"
              onClick={() => setGroupBy(null)}
              className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-black/[0.06] hover:text-[var(--color-danger)]"
              aria-label={messages.taskWorkspace.groupPanel.clear}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        )}

        {sortRules.map((rule, index) => {
          const label = localizedSortFields.find((field) => field.value === rule.field)?.label ?? rule.field;
          const rank = index === 0 ? messages.taskWorkspace.sortBuilder.primary : messages.taskWorkspace.sortBuilder.secondary;
          return (
            <span
              key={rule.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-primary)]"
            >
              <span className="font-medium">{messages.taskWorkspace.sort}</span>
              <span className="text-[var(--color-text-tertiary)]">{rank}</span>
              <span className="max-w-[14rem] truncate">{label}</span>
              <span className="text-[var(--color-text-tertiary)]">
                {rule.direction === "asc" ? messages.taskWorkspace.sortBuilder.ascending : messages.taskWorkspace.sortBuilder.descending}
              </span>
              <button
                type="button"
                onClick={() => removeSortRule(rule.id)}
                className="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-black/[0.06] hover:text-[var(--color-danger)]"
                aria-label={messages.taskWorkspace.sortBuilder.removeRule}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
    );
  };

  const renderFilterSidePanel = () => (
    <>
      <div className="fixed inset-0 z-[65] bg-black/20 md:hidden" onClick={closeActivePanel} aria-hidden="true" />
      <aside
        className={taskToolSidePanelClass}
        aria-label={messages.taskWorkspace.filterConditions}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
              {messages.taskWorkspace.filterConditions}
            </h2>
            <p className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--color-text-tertiary)]">
              {messages.taskWorkspace.filterDescription}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            >
              {messages.taskWorkspace.clearFilters}
            </button>
            <button
              type="button"
              onClick={closeActivePanel}
              className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              aria-label={messages.common.close}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[length:var(--text-2xs)] font-semibold uppercase text-[var(--color-text-tertiary)]">
                {messages.taskWorkspace.activeFilters}
              </h3>
              {showFilterCombinator && (
                <div className="flex items-center gap-2 text-[length:var(--text-2xs)]">
                  <span className="font-semibold text-[var(--color-text-secondary)]">{messages.taskWorkspace.filterCombinator.label}</span>
                  <div
                    className="inline-flex h-7 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
                    role="group"
                    aria-label={messages.taskWorkspace.filterCombinator.label}
                  >
                    {(["AND", "OR"] as FilterCombinator[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filterCombinator === value}
                        onClick={() => setFilterCombinator(value)}
                        className={cn(
                          "min-w-12 px-2 text-[length:var(--text-2xs)] transition-colors",
                          value === "OR" && "border-l border-[var(--color-border)]",
                          filterCombinator === value
                            ? "bg-[var(--color-accent)] text-white"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
                        )}
                      >
                        {value === "AND" ? messages.taskWorkspace.filterCombinator.and : messages.taskWorkspace.filterCombinator.or}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {filterConditions.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-4 text-center text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
                {messages.taskWorkspace.noFilters}
              </p>
            ) : (
              <div className="grid gap-2">
                {filterConditions.map((condition) => {
                  const valueOptions = getFilterValueOptions(condition.field);
                  const fieldKind = getFilterFieldKind(condition.field, customFilterFieldById);
                  const normalizedOperator = normalizeOperatorForKind(condition.operator, fieldKind);
                  const operatorOptions = FILTER_OPERATORS_BY_KIND[fieldKind].map((operator) => ({
                    value: operator,
                    label: filterOperatorLabels[operator],
                  }));
                  const fieldPlaceholder = filterFieldPlaceholders[condition.field as keyof typeof filterFieldPlaceholders] ?? messages.taskWorkspace.inputValue;
                  const locked = condition.locked === true;

                  return (
                    <div
                      key={condition.id}
                      className={cn(
                        "relative rounded-[var(--radius-md)] border p-3 shadow-[var(--shadow-xs)]",
                        locked
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-primary)]",
                      )}
                      title={locked ? messages.taskWorkspace.filterMyTaskLockedHint : undefined}
                    >
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => removeFilterCondition(condition.id)}
                          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[length:var(--text-xs)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]"
                          aria-label={messages.taskWorkspace.removeFilter}
                        >
                          <CloseIcon className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <div className={cn("grid gap-2", !locked && "pr-8")}>
                        {locked ? (
                          <span className="flex h-9 items-center rounded-[var(--radius-sm)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-xs)] text-[var(--color-accent)]">
                            {messages.taskWorkspace.lockedFilterPrefix} · {getFilterFieldLabelText(condition.field)}
                          </span>
                        ) : (
                          <Combobox
                            options={filterFieldOptions}
                            value={condition.field}
                            onChange={(value) => updateFilterCondition(condition.id, (current) => {
                              const next = createFilterCondition(value, getFilterFieldKind(value, customFilterFieldById));
                              return { ...next, id: current.id };
                            })}
                            className="w-full"
                            triggerClassName={panelSelectTriggerClassName}
                            placeholder={messages.taskWorkspace.filterField}
                            dropdownWidth="w-56"
                            renderTrigger={(option) => (
                              <>
                                <span className="truncate">{option?.label ?? getFilterFieldLabelText(condition.field)}</span>
                                <ChevronDownIcon className={panelSelectChevronClassName} />
                              </>
                            )}
                          />
                        )}

                        {locked ? (
                          <span className="flex h-9 items-center rounded-[var(--radius-sm)] bg-[var(--color-bg-primary)] px-2.5 text-[length:var(--text-xs)] text-[var(--color-accent)]">
                            {filterOperatorLabels[normalizedOperator]}
                          </span>
                        ) : (
                          <Combobox
                            options={operatorOptions}
                            value={normalizedOperator}
                            onChange={(value) => updateFilterCondition(condition.id, (current) => {
                              const operator = normalizeOperatorForKind(value as FilterOperator, fieldKind);
                              const nextValue = fieldKind === "select" || fieldKind === "multiselect"
                                ? (Array.isArray(current.value) ? current.value : current.value ? [current.value] : [])
                                : (Array.isArray(current.value) ? "" : current.value);
                              return {
                                ...current,
                                operator,
                                value: nextValue,
                                value2: operator === "between" ? current.value2 ?? "" : undefined,
                              };
                            })}
                            className="w-full"
                            triggerClassName={panelSelectTriggerClassName}
                            placeholder={messages.taskWorkspace.filterOperator}
                            dropdownWidth="w-44"
                            renderTrigger={(option) => (
                              <>
                                <span className="truncate">{option?.label ?? filterOperatorLabels[normalizedOperator]}</span>
                                <ChevronDownIcon className={panelSelectChevronClassName} />
                              </>
                            )}
                          />
                        )}

                        {renderFilterValueEditor({
                          fieldKind,
                          operator: normalizedOperator,
                          value: condition.value,
                          value2: condition.value2,
                          valueOptions,
                          placeholder: fieldPlaceholder,
                          disabled: locked,
                          onValueChange: (value) => updateFilterCondition(condition.id, (current) => ({ ...current, value })),
                          onValue2Change: (value2) => updateFilterCondition(condition.id, (current) => ({ ...current, value2 })),
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!forceMyTasks && currentUserId && (
              <button
                type="button"
                onClick={() => setFilterMyTasks((current) => !current)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-[length:var(--text-xs)] transition-colors",
                  filterMyTasks
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
                )}
              >
                {messages.taskWorkspace.onlyMyTasks}
              </button>
            )}
          </section>

          <section className="space-y-3 border-t border-[var(--color-border)] pt-3">
            <h3 className="text-[length:var(--text-2xs)] font-semibold uppercase text-[var(--color-text-tertiary)]">
              {messages.taskWorkspace.addFilterCondition}
            </h3>
            <div className="grid gap-2">
              <Combobox
                options={filterFieldOptions}
                value={filterDraftField}
                onChange={(value) => selectFilterDraftField(value)}
                className="w-full"
                triggerClassName={panelSelectTriggerClassName}
                placeholder={messages.taskWorkspace.filterField}
                dropdownWidth="w-56"
                renderTrigger={(option) => (
                  <>
                    <span className={cn("truncate", option ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]")}>{option?.label ?? messages.taskWorkspace.filterField}</span>
                    <ChevronDownIcon className={panelSelectChevronClassName} />
                  </>
                )}
              />

              <Combobox
                options={FILTER_OPERATORS_BY_KIND[filterDraftKind].map((operator) => ({ value: operator, label: filterOperatorLabels[operator] }))}
                value={normalizedFilterDraftOperator}
                onChange={(value) => updateFilterDraftOperator(value as FilterOperator)}
                className="w-full"
                triggerClassName={panelSelectTriggerClassName}
                placeholder={messages.taskWorkspace.filterOperator}
                dropdownWidth="w-44"
                renderTrigger={(option) => (
                  <>
                    <span className="truncate">{option?.label ?? filterOperatorLabels[normalizedFilterDraftOperator]}</span>
                    <ChevronDownIcon className={panelSelectChevronClassName} />
                  </>
                )}
              />

              {filterDraftField ? renderFilterValueEditor({
                fieldKind: filterDraftKind,
                operator: normalizedFilterDraftOperator,
                value: filterDraftValue,
                value2: filterDraftValue2,
                valueOptions: getFilterValueOptions(filterDraftField),
                placeholder: filterFieldPlaceholders[filterDraftField as keyof typeof filterFieldPlaceholders] ?? messages.taskWorkspace.inputValue,
                onValueChange: setFilterDraftValue,
                onValue2Change: setFilterDraftValue2,
              }) : (
                <p className="flex h-9 items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] px-2.5 text-[length:var(--text-xs)] text-[var(--color-text-tertiary)]">
                  {messages.taskWorkspace.selectFilterFieldFirst}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={addFilterDraftCondition} disabled={!canAddFilterDraft}>
                  {messages.taskWorkspace.addFilter}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetFilterDraft}>
                  {messages.common.cancel}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  );

  const renderSortSidePanel = () => (
    <>
      <div className="fixed inset-0 z-[65] bg-black/20 md:hidden" onClick={closeActivePanel} aria-hidden="true" />
      <aside
        className={taskToolSidePanelClass}
        aria-label={messages.taskWorkspace.sort}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
          <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
            {messages.taskWorkspace.sort}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortRules([])}
              disabled={sortRules.length === 0}
              className="whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--text-2xs)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {messages.taskWorkspace.sortBuilder.clearAll}
            </button>
            <button
              type="button"
              onClick={closeActivePanel}
              className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              aria-label={messages.common.close}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {renderSortSection({ showHeader: false })}
        </div>
      </aside>
    </>
  );

  const renderColumnsSidePanel = () => (
    <>
      <div className="fixed inset-0 z-[65] bg-black/20 md:hidden" onClick={closeActivePanel} aria-hidden="true" />
      <TaskColumnsPanel
        columns={taskColumns}
        getColumnLabel={getTaskColumnLabel}
        onColumnStateChange={updateColumnState}
        onClose={closeActivePanel}
      />
    </>
  );

  const renderGroupSidePanel = () => (
    <>
      <div className="fixed inset-0 z-[65] bg-black/20 md:hidden" onClick={closeActivePanel} aria-hidden="true" />
      <TaskGroupPanel
        options={taskGroupOptions}
        groupBy={groupBy}
        onGroupChange={(nextGroupBy) => {
          setGroupBy(nextGroupBy);
          setActiveToolPanel(null);
        }}
        onClose={closeActivePanel}
      />
    </>
  );

  const renderBulkSidePanel = (overlay = false) => (
    <>
      <div
        className={overlay ? "fixed inset-0 z-[69] bg-black/25" : "fixed inset-0 z-[65] bg-black/20 md:hidden"}
        onClick={closeActivePanel}
        aria-hidden="true"
      />
      <BulkEditSidePanel
        key={`${bulkPanelTab}-${selectedBulkTaskIdsKey}`}
        selectedTasks={selectedBulkTasks}
        statuses={statuses}
        allowedStatusIdsByIssueType={allowedStatusIdsByIssueType}
        transitionsByIssueType={transitionsByIssueType}
        workspaceFields={workspaceFields}
        pending={bulkActions.pending}
        initialTab={bulkPanelTab}
        overlay={overlay}
        onClose={closeActivePanel}
        onApplyFieldChange={bulkActions.applyFieldChange}
        onApplyStatusChange={bulkActions.applyStatusChange}
      />
    </>
  );

  const renderFullscreenUnitSegments = () => {
    if (!fullscreenView || (fullscreenView !== "gantt" && fullscreenView !== "calendar")) return null;

    const activeUnit = fullscreenView === "gantt" ? ganttUnit : calendarUnit;
    return (
      <div
        className="inline-flex h-8 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg-primary)]"
        data-fullscreen-unit-segmented={fullscreenView}
      >
        {localizedGanttUnitOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (fullscreenView === "gantt") {
                setGanttUnit(option.value);
              } else {
                setCalendarUnit(option.value);
              }
            }}
            className={cn(
              "px-3 text-[length:var(--text-xs)] transition-colors",
              activeUnit === option.value
                ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  };

  const renderTaskView = (mode: ViewMode = viewMode, fullscreen = false) => {
    const commonProps = {
      tasks: displayTasks,
      statuses,
      issueTypes,
      issueTypesByProjectId,
      allowedStatusIdsByIssueType,
      transitionsByIssueType,
      onUpdate: handleTaskUpdate,
      onSelect: handleSelectTask,
      onCommentClick: handleCommentClick,
      onContextMenu: handleTaskContextMenu,
      fieldVisibility,
      hierarchyDepthById: depthMap,
      splitHierarchy,
      hasChildrenIds,
      allChildCountById,
      childProgressById,
      collapsedIds,
      onToggleCollapse: toggleCollapse,
      projectMembersByProjectId,
      highlightQuery: titleHighlightQuery,
      workspaceFields,
      visibleCustomFieldIds,
      canEditByProjectId,
    };
    const selectionProps = (mode === "list" || mode === "grid")
      ? {
          selectedIds: bulkSelectedIds,
          onToggleManySelected: toggleManyBulkSelected,
          onSelectAllVisible: toggleAllVisibleSelected,
          getSelectionAnchorId: getBulkSelectionAnchorId,
          setSelectionAnchorId: setBulkSelectionAnchorId,
        }
      : {};

    if (mode === "grid") {
      return <TaskGrid {...commonProps} {...selectionProps} groups={groupSections ?? undefined} columns={visibleTaskColumns} columnWidths={columnWidths} onColumnWidthChange={handleColumnWidthChange} isFullscreen={fullscreen} />;
    }
    if (mode === "kanban") {
      return <TaskKanban {...commonProps} isFullscreen={fullscreen} />;
    }
    if (mode === "gantt") {
      return <TaskGantt tasks={displayTasks} statuses={statuses} allowedStatusIdsByIssueType={allowedStatusIdsByIssueType} transitionsByIssueType={transitionsByIssueType} onUpdate={handleTaskUpdate} onSelect={handleSelectTask} onCommentClick={handleCommentClick} onContextMenu={handleTaskContextMenu} fieldVisibility={fieldVisibility} columnWidths={columnWidths} onColumnWidthChange={handleColumnWidthChange} hierarchyDepthById={depthMap} splitHierarchy={splitHierarchy} hasChildrenIds={hasChildrenIds} allChildCountById={allChildCountById} childProgressById={childProgressById} collapsedIds={collapsedIds} onToggleCollapse={toggleCollapse} displayRangeStart={resolvedGanttRange.start} displayRangeEnd={resolvedGanttRange.end} displayUnit={ganttUnit} isFullscreen={fullscreen} projectMembersByProjectId={projectMembersByProjectId} highlightQuery={titleHighlightQuery} stickyTopOffset={0} />;
    }
    if (mode === "calendar") {
      return <TaskCalendar tasks={displayTasks} statuses={statuses} issueTypes={issueTypes} onUpdate={handleTaskUpdate} onSelect={handleSelectTask} onContextMenu={handleTaskContextMenu} fieldVisibility={fieldVisibility} hierarchyDepthById={depthMap} splitHierarchy={splitHierarchy} hasChildrenIds={hasChildrenIds} collapsedIds={collapsedIds} onToggleCollapse={toggleCollapse} onCreateTaskAtDate={handleCreateTaskAtDate} anchorDate={calendarAnchorDate} onAnchorDateChange={setCalendarAnchorDate} onSelectDate={handleCalendarSelectDate} displayUnit={calendarUnit} isFullscreen={fullscreen} />;
    }
    return <TaskList {...commonProps} {...selectionProps} groups={groupSections ?? undefined} columns={visibleTaskColumns} />;
  };

  const contentUsesIntrinsicHeight = effectiveViewMode === "calendar" && calendarUnit === "day";
  const shellNeedsFixedHeight = !isTaskFullscreen && !contentUsesIntrinsicHeight;
  const contentPaneStyle = contentUsesIntrinsicHeight && workspaceViewportHeight ? { maxHeight: `${workspaceViewportHeight}px` } : undefined;
  const fullscreenTitle = fullscreenView
    ? `${localizedViewModes.find((mode) => mode.key === fullscreenView)?.label ?? messages.taskWorkspace.viewSettings} ${messages.taskWorkspace.fullscreen}`
    : "";

  return (
    <div
      ref={workspaceShellRef}
      className={cn(
        "min-w-0 flex flex-col gap-2 overflow-x-clip",
        shellNeedsFixedHeight && "min-h-0"
      )}
      style={shellNeedsFixedHeight && workspaceViewportHeight ? { height: `${workspaceViewportHeight}px` } : undefined}
    >
      {(title || description) && (
        <div>
          {title && <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h1>}
          {description && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>}
        </div>
      )}

      <div
        ref={toolbarRef}
        data-feature-toolbar="true"
        className={cn(featureToolbarSurfaceClass, "@container/task-toolbar")}
      >
        <div className={cn(
          "grid min-w-0 gap-2",
          !isReadOnlyDemo && onCreateTask
            ? "@[42rem]/task-toolbar:grid-cols-[12rem_minmax(0,1fr)] @[42rem]/task-toolbar:items-center @[42rem]/task-toolbar:gap-5 @[42rem]/task-toolbar:transition-[grid-template-columns] @[42rem]/task-toolbar:duration-200 @[42rem]/task-toolbar:[&:has([data-task-toolbar-zone=quick-create]:focus-within)]:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] @[64rem]/task-toolbar:gap-6"
            : "grid-cols-1"
        )} data-task-toolbar-layout="true">
          {!isReadOnlyDemo && onCreateTask && (
            <div data-task-toolbar-zone="quick-create" data-task-bar-expand-on-focus="true" className="hidden min-w-0 @[42rem]/task-toolbar:block">
              <TaskBar onCreateTask={handleQuickCreateTask} isLoading={createPending} />
            </div>
          )}
          <div
            data-feature-toolbar-row="true"
            data-task-toolbar-zone="controls"
            className="@container/toolbar-controls flex min-w-0 flex-nowrap items-center justify-end gap-1 overflow-visible py-0.5 md:gap-1.5"
          >
            <div
              data-task-toolbar-group="primary-actions"
              className="flex shrink-0 flex-nowrap items-center justify-end gap-1 overflow-visible max-[359px]:gap-0.5 md:gap-1.5"
            >
              {!isReadOnlyDemo && onCreateTask && (
                <button
                  type="button"
                  aria-label={messages.nav.createTask}
                  title={messages.nav.createTask}
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-full bg-[var(--color-accent-light)] px-2 text-[length:var(--text-xs)] leading-none text-[var(--color-accent)] transition-colors hover:bg-[var(--color-bg-hover)] max-[359px]:h-8 max-[359px]:min-w-8 max-[359px]:px-1.5 @[42rem]/task-toolbar:hidden"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span className="sr-only">{messages.common.create}</span>
                </button>
              )}
              {!todayMode && <button
                type="button"
                aria-label={messages.taskWorkspace.filter}
                title={messages.taskWorkspace.filter}
                onClick={() => handleToolPanelToggle("filter")}
                className={cn(
                  featureToolbarButtonClass,
                  activeToolPanel === "filter" && featureToolbarButtonActiveClass,
                  "max-[767px]:h-9 max-[767px]:min-w-9 max-[767px]:gap-1 max-[767px]:px-2 max-[767px]:text-[length:var(--text-xs)] max-[359px]:h-8 max-[359px]:min-w-8 max-[359px]:px-1.5"
                )}
              >
                <FilterIcon className="h-3.5 w-3.5" />
                <span className="hidden truncate lg:inline">{messages.taskWorkspace.filter}</span>
                {activeFilterCount > 0 && (
                  <span className={featureToolbarBadgeClass}>
                    {activeFilterCount}
                  </span>
                )}
              </button>}

              {!todayMode && <button
                type="button"
                aria-label={messages.taskWorkspace.sort}
                title={messages.taskWorkspace.sort}
                onClick={() => handleToolPanelToggle("sort")}
                className={cn(
                  featureToolbarButtonClass,
                  activeToolPanel === "sort" && featureToolbarButtonActiveClass,
                  "max-[767px]:h-9 max-[767px]:min-w-9 max-[767px]:gap-1 max-[767px]:px-2 max-[767px]:text-[length:var(--text-xs)] max-[359px]:h-8 max-[359px]:min-w-8 max-[359px]:px-1.5"
                )}
              >
                <SortIcon className="h-3.5 w-3.5" />
                <span className="hidden truncate lg:inline">{messages.taskWorkspace.sort}</span>
                {sortRules.length > 0 && (
                  <span className={featureToolbarBadgeClass}>
                    {sortRules.length}
                  </span>
                )}
              </button>}
            </div>
            <div
              data-task-toolbar-group="view-actions"
              className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1 overflow-visible max-[359px]:gap-0.5 md:gap-1.5"
            >
              {todayMode ? renderTodayControls() : (
                <>
                  {renderMobileViewModeSelector()}
                  <div className="hidden lg:block">
                    {renderViewModeSegments()}
                  </div>
                  {renderToolbarViewSettings()}

                  <div data-task-toolbar-saved-views="true" className="shrink-0">
                    <TaskSavedViews
                      workspaceKey={savedViewsWorkspaceKey}
                      currentConfig={currentSavedViewConfig}
                      views={savedViewsData.views}
                      defaultViewId={savedViewsData.defaultViewId}
                      activeViewId={activeViewId}
                      isLoading={savedViewsQuery.isLoading}
                      enabled={Boolean(savedViewsWorkspaceKey)}
                      canManageDefault={canManageSavedViewDefaults}
                      compact
                      onApplyView={applySavedView}
                      onClearActiveView={clearActiveSavedView}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {renderAppliedStateChips()}
      </div>

      <div className={cn("relative flex min-h-0 min-w-0", !contentUsesIntrinsicHeight && "flex-1")}>
        <div className="min-h-0 min-w-0 flex-1">
          {!isTaskFullscreen && (
            <div
              ref={contentScrollRef}
              aria-busy={isLoading}
              className={cn(
                "rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] p-0",
                contentUsesIntrinsicHeight
                  ? "max-h-full min-h-0 overflow-y-auto"
                  : "h-full min-h-0 overflow-y-auto",
                effectiveViewMode === "grid" || effectiveViewMode === "gantt"
                  ? "overflow-x-auto overscroll-x-contain"
                  : "overflow-x-hidden"
              )}
              style={contentPaneStyle}
            >
              {renderTaskView(effectiveViewMode)}
            </div>
          )}
        </div>

        {activeToolPanel === "filter" && renderFilterSidePanel()}
        {activeToolPanel === "sort" && renderSortSidePanel()}
        {activeToolPanel === "columns" && renderColumnsSidePanel()}
        {activeToolPanel === "group" && renderGroupSidePanel()}
        {!isTaskFullscreen && activeToolPanel === "bulk" && renderBulkSidePanel()}
      </div>

      {isTaskFullscreen && fullscreenView && (
        <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)] p-3 md:p-4">
          <div className="flex h-full flex-col gap-2">
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] px-3 py-2">
              <div className="min-w-0 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {fullscreenTitle}
                </span>
              </div>
              {renderFullscreenUnitSegments()}
              <button type="button" onClick={closeFullscreenView} className={featureToolbarButtonClass}>
                <span>[]</span>
                <span>{messages.taskWorkspace.exitFullscreen}</span>
              </button>
            </div>

            <div className={cn("min-h-0 flex-1", fullscreenUsesDocumentScroll ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden")}>
              {renderTaskView(fullscreenView, true)}
            </div>
          </div>
        </div>
      )}

      {isTaskFullscreen && activeToolPanel === "bulk" && renderBulkSidePanel(true)}

      {bulkSelectionVisible && selectedBulkTasks.length > 0 && (
        <BulkActionBar
          selectedCount={selectedBulkTasks.length}
          pending={bulkActions.pending}
          onOpenFieldPanel={() => openBulkPanel("field")}
          onOpenStatusPanel={() => openBulkPanel("status")}
          onRequestDelete={requestBulkDelete}
          onClearSelection={clearBulkSelection}
        />
      )}

      {activeSelectedTask && (
        <TaskDetailPanel
          key={activeSelectedTask.id}
          task={activeSelectedTask}
          allTasks={tasks}
          statuses={statuses}
          issueTypes={issueTypes}
          projects={projects}
          scrollRequest={panelScrollRequest && panelScrollRequest.taskId === activeSelectedTask.id ? panelScrollRequest : null}
          onClose={() => {
            setPanelScrollRequest(null);
            setSelectedTask(null);
            clearTaskQueryParam();
          }}
          onUpdate={handleTaskUpdate}
          onRefresh={onRefresh}
          onSelect={handleSelectTask}
          onDelete={onDelete}
          onEditInModal={openEditModal}
        />
      )}

      {contextMenu?.kind === "single" && (
        <ContextMenu
          task={contextMenu.task}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          statuses={statuses}
          issueTypes={issueTypes}
          onClose={() => setContextMenu(null)}
          onOpen={() => handleSelectTask(contextMenu.task)}
          onUpdate={handleTaskUpdate}
          onDelete={onDelete}
        />
      )}

      {contextMenu?.kind === "bulk" && (
        <>
          <div
            className="fixed inset-0 z-[200]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu(null);
            }}
          />
          <BulkContextMenu
            selectedTasks={selectedBulkTasks}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            statuses={statuses}
            allowedStatusIdsByIssueType={allowedStatusIdsByIssueType}
            transitionsByIssueType={transitionsByIssueType}
            workspaceFields={workspaceFields}
            pending={bulkActions.pending}
            onClose={() => setContextMenu(null)}
            onApplyStatusChange={bulkActions.applyStatusChange}
            onOpenStatusPanel={() => openBulkPanel("status")}
            onOpenFieldPanel={() => openBulkPanel("field")}
            onRequestDelete={requestBulkDelete}
            onClearSelection={clearBulkSelection}
          />
        </>
      )}

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        title={messages.taskWorkspace.bulkBar.deleteConfirmTitle}
        description={messages.taskWorkspace.bulkBar.deleteConfirmDescription.replace("{count}", String(selectedBulkTasks.length))}
        confirmLabel={messages.taskWorkspace.bulkBar.deleteAction}
        cancelLabel={messages.common.cancel}
        variant="danger"
        busy={bulkActions.pending}
        onConfirm={bulkActions.deleteSelected}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
      />

      {!isReadOnlyDemo && createModalOpen && (
        <CreateTaskModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={onRefresh}
          defaultProjectId={defaultCreateProjectId}
          allowNoProject={!defaultCreateProjectId}
          restrictToProjectIds={createProjectIds}
        />
      )}

      {!isReadOnlyDemo && createTaskPreset && (
        <CreateTaskModal
          key={`calendar-${createTaskPreset.dueDate ?? ""}`}
          onClose={() => setCreateTaskPreset(null)}
          onSuccess={onRefresh}
          defaultProjectId={defaultCreateProjectId}
          allowNoProject={!defaultCreateProjectId}
          restrictToProjectIds={createProjectIds}
          initialValues={createTaskPreset}
        />
      )}

      {!isReadOnlyDemo && editModalState && (
        <CreateTaskModal
          key={`edit-${editModalState.task.id}-${editModalState.targetIssueTypeId ?? editModalState.task.issueTypeId}`}
          task={editModalState.task}
          targetIssueTypeId={editModalState.targetIssueTypeId}
          onClose={() => setEditModalState(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
