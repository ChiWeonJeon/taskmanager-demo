import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveTaskWorkspaceMetadata } from "../../lib/task-page-metadata";

const mainLayoutPath = fileURLToPath(new URL("../../app/(main)/layout.tsx", import.meta.url));
const globalsCssPath = fileURLToPath(new URL("../../app/globals.css", import.meta.url));
const taskWorkspacePath = fileURLToPath(new URL("./task-workspace.tsx", import.meta.url));
const taskSavedViewsPath = fileURLToPath(new URL("./task-saved-views.tsx", import.meta.url));
const featureToolbarPath = fileURLToPath(new URL("../layout/feature-toolbar.tsx", import.meta.url));
const taskListPath = fileURLToPath(new URL("./task-list.tsx", import.meta.url));
const taskGridPath = fileURLToPath(new URL("./task-grid.tsx", import.meta.url));
const taskGanttPath = fileURLToPath(new URL("./task-gantt.tsx", import.meta.url));
const taskCalendarPath = fileURLToPath(new URL("./task-calendar.tsx", import.meta.url));

test("task workspace source keeps sticky and fullscreen task view plumbing", () => {
  const mainLayoutSource = readFileSync(mainLayoutPath, "utf8");
  const globalsCssSource = readFileSync(globalsCssPath, "utf8");
  const taskWorkspaceSource = readFileSync(taskWorkspacePath, "utf8");
  const taskSavedViewsSource = readFileSync(taskSavedViewsPath, "utf8");
  const featureToolbarSource = readFileSync(featureToolbarPath, "utf8");
  const taskListSource = readFileSync(taskListPath, "utf8");
  const taskGridSource = readFileSync(taskGridPath, "utf8");
  const taskGanttSource = readFileSync(taskGanttPath, "utf8");
  const taskCalendarSource = readFileSync(taskCalendarPath, "utf8");
  const viewSettingsToolbarIndex = taskWorkspaceSource.indexOf("{renderToolbarViewSettings()}");
  const savedViewsToolbarIndex = taskWorkspaceSource.indexOf('data-task-toolbar-saved-views="true"');

  assert.ok(mainLayoutSource.includes("overflow-x-hidden"));
  assert.ok(globalsCssSource.includes('html[data-task-fullscreen="true"] .mobile-nav-root'));

  assert.ok(taskWorkspaceSource.includes("ResizeObserver"));
  assert.ok(taskWorkspaceSource.includes("stickyTopOffset"));
  assert.ok(taskWorkspaceSource.includes("const bottomInset = window.innerWidth < 768 ? 96 : 0;"));
  assert.ok(taskWorkspaceSource.includes("overflow-x-auto overscroll-x-contain"));
  assert.ok(taskWorkspaceSource.includes("type FullscreenView = ViewMode;"));
  assert.ok(taskWorkspaceSource.includes("data-fullscreen-unit-segmented"));
  assert.ok(taskWorkspaceSource.includes("openFullscreenView(viewMode)"));
  assert.ok(taskWorkspaceSource.includes("featureToolbarLabelClass"));
  assert.ok(featureToolbarSource.includes('export const featureToolbarLabelClass = "inline truncate"'));
  assert.ok(featureToolbarSource.includes('export const featureToolbarResponsiveLabelClass'));
  assert.ok(featureToolbarSource.includes("flex min-w-0 flex-nowrap items-center"));
  assert.ok(featureToolbarSource.includes("rounded-full bg-[var(--color-bg-secondary)]"));
  assert.ok(taskWorkspaceSource.includes("@[42rem]/task-toolbar:grid-cols-[12rem_minmax(0,1fr)]"));
  assert.ok(taskWorkspaceSource.includes("@[42rem]/task-toolbar:[&:has([data-task-toolbar-zone=quick-create]:focus-within)]:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]"));
  assert.ok(taskWorkspaceSource.includes('data-task-toolbar-zone="quick-create"'));
  assert.ok(taskWorkspaceSource.includes('data-task-toolbar-zone="controls"'));
  assert.ok(taskWorkspaceSource.includes('data-task-toolbar-group="primary-actions"'));
  assert.ok(taskWorkspaceSource.includes('data-task-toolbar-group="view-actions"'));
  assert.ok(taskWorkspaceSource.includes("@container/toolbar-controls flex min-w-0 flex-nowrap items-center justify-end gap-1 overflow-visible"));
  assert.ok(taskWorkspaceSource.includes("md:gap-1.5"));
  assert.ok(taskWorkspaceSource.includes('data-task-view-mode-menu-trigger="true"'));
  assert.ok(taskWorkspaceSource.includes('data-task-view-mode-menu="true"'));
  assert.ok(taskWorkspaceSource.includes("lg:hidden"));
  assert.ok(taskWorkspaceSource.includes('className="hidden lg:block"'));
  assert.ok(taskWorkspaceSource.includes('data-task-applied-state-chips="true"'));
  assert.ok(taskWorkspaceSource.includes('"flex flex-wrap items-center gap-2 px-1 pb-1 pt-2"'));
  assert.ok(taskWorkspaceSource.includes('!todayMode && "hidden md:flex"'));
  assert.ok(!taskWorkspaceSource.includes("md:border-l md:border-[var(--color-border)]"));
  assert.ok(taskWorkspaceSource.includes('viewMode === mode.key ? "inline" : "hidden 2xl:inline"'));
  assert.ok(taskWorkspaceSource.includes("max-[767px]:max-w-12"));
  assert.ok(taskWorkspaceSource.includes("h-9 min-w-9 shrink-0"));
  assert.ok(taskWorkspaceSource.includes("max-[767px]:h-9 max-[767px]:min-w-9"));
  assert.ok(taskWorkspaceSource.includes('<span className="sr-only">{messages.common.create}</span>'));
  assert.ok(taskWorkspaceSource.includes('data-task-toolbar-saved-views="true"'));
  assert.ok(!taskWorkspaceSource.includes("sm:ml-auto"));
  assert.ok(taskSavedViewsSource.includes('data-task-saved-views-trigger="true"'));
  assert.ok(taskSavedViewsSource.includes("hidden truncate lg:inline"));
  assert.ok(taskSavedViewsSource.includes("max-[767px]:h-9 max-[767px]:min-w-9"));
  assert.ok(taskSavedViewsSource.includes("aria-expanded={open}"));
  assert.ok(!taskWorkspaceSource.includes("toolbarCollapsed"));
  assert.ok(!taskWorkspaceSource.includes("effectiveToolbarCollapsed"));
  assert.ok(!taskWorkspaceSource.includes('data-task-toolbar-collapsed="true"'));
  assert.ok(!taskWorkspaceSource.includes("collapseToolbar"));
  assert.ok(!taskWorkspaceSource.includes("expandToolbar"));
  assert.ok(viewSettingsToolbarIndex > -1);
  assert.ok(savedViewsToolbarIndex > viewSettingsToolbarIndex);
  assert.ok(taskWorkspaceSource.includes('type TaskToolPanel = "filter" | "sort" | "columns" | "group" | "bulk";'));
  assert.ok(taskWorkspaceSource.includes("const renderAppliedStateChips = () =>"));
  assert.ok(taskWorkspaceSource.includes("const renderFilterSidePanel = () =>"));
  assert.ok(taskWorkspaceSource.includes("const renderSortSidePanel = () =>"));
  assert.ok(taskWorkspaceSource.includes('activeToolPanel === "filter" && renderFilterSidePanel()'));
  assert.ok(taskWorkspaceSource.includes('activeToolPanel === "sort" && renderSortSidePanel()'));
  assert.ok(taskWorkspaceSource.includes("renderSortSection({ showHeader: false })"));
  assert.ok(taskWorkspaceSource.includes('const contentUsesIntrinsicHeight = effectiveViewMode === "calendar" && calendarUnit === "day";'));
  assert.ok(taskWorkspaceSource.includes("const shellNeedsFixedHeight = !isTaskFullscreen && !contentUsesIntrinsicHeight;"));
  assert.ok(taskWorkspaceSource.includes('style={shellNeedsFixedHeight && workspaceViewportHeight ? { height: `${workspaceViewportHeight}px` } : undefined}'));
  assert.ok(taskWorkspaceSource.includes("const renderViewModeSegments = (compact = false) =>"));
  assert.ok(taskWorkspaceSource.includes('data-task-view-mode-segmented="true"'));
  assert.ok(taskWorkspaceSource.includes("const renderViewContextControls = (compact = false) =>"));
  assert.ok(taskWorkspaceSource.includes("const renderGanttRangePopover = () =>"));
  assert.ok(taskWorkspaceSource.includes("import { FloatingPortal }"));
  assert.ok(taskWorkspaceSource.includes("anchorRef={ganttRangeButtonRef}"));
  assert.ok(taskWorkspaceSource.includes("preferredWidth={360}"));
  assert.ok(!taskWorkspaceSource.includes("viewOptionsOpen"));
  assert.ok(!taskWorkspaceSource.includes("viewOptionsButtonRef"));
  assert.ok(!taskWorkspaceSource.includes("renderViewOptionsPanel"));
  assert.ok(!taskWorkspaceSource.includes("MoreIcon"));
  assert.ok(!taskWorkspaceSource.includes("renderMoreMenu"));
  assert.ok(!taskWorkspaceSource.includes("setSortOpen"));
  assert.ok(!taskWorkspaceSource.includes("fieldsPanelRef"));
  assert.ok(!taskWorkspaceSource.includes("overflow-x-auto -mx-1 px-1 py-0.5"));
  assert.ok(taskListSource.includes("const groupingActive = Boolean(groups && groups.length > 0);"));
  assert.ok(taskListSource.includes("const showHierarchyAffordance = !splitHierarchy && !groupingActive && (hasChildren || depth > 0);"));
  assert.ok(!taskListSource.includes('data-task-list-header="true"'));
  assert.ok(!taskListSource.includes('className="w-12"'));
  assert.ok(!taskListSource.includes("border bg-[var(--color-bg-primary)]"));
  assert.ok(taskListSource.includes("outline outline-2 outline-dashed outline-[var(--color-accent)]"));

  assert.ok(taskGridSource.includes("stickyTopOffset?: number"));
  assert.ok(taskGridSource.includes("data-task-grid-header"));
  assert.ok(taskGridSource.includes("data-task-grid-body-scroll"));
  assert.ok(taskGridSource.includes("shrink-0 overflow-hidden rounded-t-[var(--radius-md)]"));
  assert.ok(taskGridSource.includes("headerScrollRef"));
  assert.ok(taskGridSource.includes("bodyScrollRef"));

  assert.ok(taskGanttSource.includes("stickyTopOffset?: number"));
  assert.ok(taskGanttSource.includes("data-task-gantt-sticky-shell"));
  assert.ok(taskGanttSource.includes("leftHeaderScrollRef"));
  assert.ok(taskGanttSource.includes("rightHeaderScrollRef"));
  assert.ok(taskGanttSource.includes("leftBodyScrollViewportRef"));
  assert.ok(taskGanttSource.includes("rightBodyScrollViewportRef"));
  assert.ok(taskGanttSource.includes("bodyScrollClassName"));
  assert.ok(taskGanttSource.includes("bodyScrollViewportClassName"));
  assert.ok(taskGanttSource.includes("const bodyRowsHeight = tasks.length * ROW_HEIGHT;"));
  assert.ok(taskGanttSource.includes('isFullscreen ? "min-h-0 flex-1 overflow-auto" : "shrink-0 overflow-x-auto overflow-y-hidden"'));
  assert.ok(taskGanttSource.includes("const RANGE_HEADER_HEIGHT = 36;"));
  assert.ok(taskGanttSource.includes("rangeHeaderStyle"));
  assert.ok(taskGanttSource.includes('data-task-gantt-range-header="true"'));
  assert.ok(taskGanttSource.includes("stickyTopOffset + (isFullscreen ? 0 : RANGE_HEADER_HEIGHT)"));
  assert.ok(taskGanttSource.includes("taskGanttRootClassName"));
  assert.ok(taskGanttSource.includes('isFullscreen ? "h-full min-h-0" : "min-h-full"'));
  assert.ok(taskGanttSource.includes("taskGanttMainClassName"));
  assert.ok(taskGanttSource.includes('isFullscreen ? "flex-1" : "flex-none"'));
  assert.ok(taskGanttSource.includes('data-task-gantt-root="true"'));
  assert.ok(taskGanttSource.includes('data-task-gantt-main="true"'));
  assert.ok(taskGanttSource.includes("rightBodyScrollViewportRef.current!.scrollTop = leftBodyScrollViewportRef.current!.scrollTop;"));
  assert.ok(taskGanttSource.includes("leftBodyScrollViewportRef.current!.scrollTop = rightBodyScrollViewportRef.current!.scrollTop;"));
  assert.ok(taskGanttSource.includes('className="flex min-w-0 flex-1 flex-col"'));

  assert.ok(taskCalendarSource.includes("stickyTopOffset?: number"));
  assert.ok(taskCalendarSource.includes("data-calendar-sticky-header"));
});

test("task workspace metadata falls back to task payload data", () => {
  const task = {
    id: "task-1",
    issueKey: "TASK-1",
    title: "Fix regression",
    description: null,
    startDate: null,
    dueDate: null,
    statusId: "status-open",
    issueTypeId: "type-task",
    projectId: "project-alpha",
    parentId: null,
    createdAt: "2026-03-26T00:00:00.000Z",
    updatedAt: "2026-03-26T00:00:00.000Z",
    deletedAt: null,
    status: {
      id: "status-open",
      name: "Open",
      color: "#2563eb",
      category: "TODO",
    },
    issueType: {
      id: "type-task",
      name: "Task",
      icon: null,
      color: "#2563eb",
      fieldSchemaId: "schema-1",
      statusSchemaId: "status-schema-1",
    },
    project: {
      id: "project-alpha",
      name: "Alpha",
      key: "ALPHA",
    },
    parent: null,
    creator: null,
    assignee: null,
    fieldValues: [],
    commentCount: 0,
    comments: [],
    histories: [],
  };

  const resolved = resolveTaskWorkspaceMetadata({
    tasks: [task],
    statuses: [],
    issueTypes: [],
    projects: [],
  });

  assert.equal(resolved.statuses.length, 1);
  assert.equal(resolved.statuses[0]?.id, "status-open");
  assert.equal(resolved.issueTypes.length, 1);
  assert.equal(resolved.issueTypes[0]?.fieldSchemaId, "schema-1");
  assert.equal(resolved.projects.length, 1);
  assert.equal(resolved.projects[0]?.key, "ALPHA");
});
