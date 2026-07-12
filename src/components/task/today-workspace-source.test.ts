import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workspaceSource = readFileSync(fileURLToPath(new URL("./task-workspace.tsx", import.meta.url)), "utf8");
const homeGlobeTabsSource = readFileSync(fileURLToPath(new URL("../layout/home-globe-tabs.tsx", import.meta.url)), "utf8");
const groupTabsSource = readFileSync(fileURLToPath(new URL("../../app/(main)/groups/[groupSlug]/group-tab-nav.tsx", import.meta.url)), "utf8");
const projectTabsSource = readFileSync(fileURLToPath(new URL("../../app/(main)/projects/[id]/project-tab-nav.tsx", import.meta.url)), "utf8");
const rootPageSource = readFileSync(fileURLToPath(new URL("../../app/page.tsx", import.meta.url)), "utf8");
const homePageSource = readFileSync(fileURLToPath(new URL("../../app/(main)/home/page.tsx", import.meta.url)), "utf8");
const globePageSource = readFileSync(fileURLToPath(new URL("../../app/(main)/globe/page.tsx", import.meta.url)), "utf8");
const projectPageSource = readFileSync(fileURLToPath(new URL("../../app/(main)/projects/[id]/page.tsx", import.meta.url)), "utf8");
const groupPageSource = readFileSync(fileURLToPath(new URL("../../app/(main)/groups/[groupSlug]/page.tsx", import.meta.url)), "utf8");
const sidebarSource = readFileSync(fileURLToPath(new URL("../layout/sidebar.tsx", import.meta.url)), "utf8");
const mobileNavSource = readFileSync(fileURLToPath(new URL("../layout/mobile-nav.tsx", import.meta.url)), "utf8");
const taskIconsSource = readFileSync(fileURLToPath(new URL("./task-icons.tsx", import.meta.url)), "utf8");

test("keeps Today first in every task-scope tab list", () => {
  assert.ok(homeGlobeTabsSource.indexOf('href: "/today"') < homeGlobeTabsSource.indexOf('href: "/tasks"'));
  assert.ok(homeGlobeTabsSource.indexOf('href: "/all-today"') < homeGlobeTabsSource.indexOf('href: "/all-tasks"'));
  assert.ok(groupTabsSource.indexOf('key: "today"') < groupTabsSource.indexOf('key: "dashboard"'));
  assert.ok(projectTabsSource.indexOf('key: "today"') < projectTabsSource.indexOf('key: "tasks"'));
});

test("uses a dedicated Today icon without replacing calendar and cycle icons", () => {
  assert.ok(taskIconsSource.includes("export function TodayIcon"));
  assert.ok(homeGlobeTabsSource.match(/href: "\/today"[\s\S]*?Icon: TodayIcon/));
  assert.ok(homeGlobeTabsSource.match(/href: "\/all-today"[\s\S]*?Icon: TodayIcon/));
  assert.ok(groupTabsSource.match(/key: "today"[\s\S]*?Icon: TodayIcon/));
  assert.ok(projectTabsSource.match(/key: "today"[\s\S]*?Icon: TodayIcon/));
  assert.ok(groupTabsSource.match(/key: "cycles"[\s\S]*?Icon: CalendarTabIcon/));
  assert.ok(projectTabsSource.match(/key: "cycles"[\s\S]*?Icon: CalendarTabIcon/));
});

test("routes default scope entry points to Today while preserving explicit secondary tabs", () => {
  assert.ok(rootPageSource.includes('redirect("/today")'));
  assert.ok(homePageSource.includes('redirect("/today")'));
  assert.ok(globePageSource.includes('redirect("/all-today")'));
  assert.ok(projectPageSource.includes('redirect(`/projects/${encodeURIComponent(id)}/today`)'));
  assert.ok(groupPageSource.includes('redirect(`/groups/${encodeURIComponent(groupSlug)}/today`)'));
  assert.ok(sidebarSource.includes('href="/today"'));
  assert.ok(sidebarSource.includes('href="/all-today"'));
  assert.ok(mobileNavSource.includes('href: "/today"'));
  assert.ok(mobileNavSource.includes('href: "/all-today"'));
  assert.ok(projectTabsSource.includes('href: `${basePath}/tasks`'));
  assert.ok(groupTabsSource.includes('href: `${basePath}/dashboard`'));
});

test("anchors Today bucket segments after variable controls and always renders applied chips", () => {
  const todayControlsStart = workspaceSource.indexOf("const renderTodayControls = () =>");
  const todayControlsEnd = workspaceSource.indexOf("const renderMobileViewModeSelector", todayControlsStart);
  const todayControls = workspaceSource.slice(todayControlsStart, todayControlsEnd);
  assert.ok(todayControls.indexOf('handleToolPanelToggle("sort")') < todayControls.indexOf('data-today-bucket-segmented="true"'));
  assert.ok(todayControls.indexOf('handleToolPanelToggle("group")') < todayControls.indexOf('data-today-bucket-segmented="true"'));
  assert.ok(todayControls.includes('data-today-toolbar-controls="true"'));
  assert.ok(todayControls.includes("flex-nowrap"));
  assert.ok(!todayControls.includes('data-today-bucket-compact="true"'));
  assert.ok(!todayControls.includes("<select"));
  assert.ok(todayControls.includes('data-today-bucket-scroll="true"'));
  assert.ok(todayControls.includes("overflow-x-auto"));
  assert.ok(todayControls.includes("featureToolbarResponsiveLabelClass"));
  assert.ok(todayControls.includes("UserIcon"));
  assert.ok(todayControls.includes("EyeOffIcon"));
  assert.ok(workspaceSource.includes("{renderAppliedStateChips()}"));
  assert.ok(workspaceSource.includes("showExcludeDoneChip"));
});

test("keeps collapsed sidebar labels and expands quick create only on focus", () => {
  assert.ok(sidebarSource.includes("min-h-12 flex-col"));
  assert.ok(sidebarSource.includes("w-full truncate px-0.5"));
  assert.ok(workspaceSource.includes('data-task-bar-expand-on-focus="true"'));
  assert.ok(workspaceSource.includes('className={cn(featureToolbarSurfaceClass, "@container/task-toolbar")}'));
  assert.ok(!workspaceSource.includes('"@container/task-toolbar grid min-w-0 gap-2"'));
  assert.ok(workspaceSource.includes("@[42rem]/task-toolbar:grid-cols-[12rem_minmax(0,1fr)]"));
  assert.ok(workspaceSource.includes("@[42rem]/task-toolbar:[&:has([data-task-toolbar-zone=quick-create]:focus-within)]:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]"));
  assert.ok(!workspaceSource.includes("@[42rem]/task-toolbar:focus-within:grid-cols"));
  assert.ok(workspaceSource.includes("@[42rem]/task-toolbar:transition-[grid-template-columns]"));
});

test("persists stable toolbar state in the account and only removes migrated legacy columns", () => {
  for (const field of [
    "filters", "combinator", "columns", "columnOrder", "viewMode", "splitHierarchy",
    "ganttUnit", "calendarUnit", "ganttRangeMode", "customGanttRange", "todayBucket",
    "filterMyTasks", "excludeDone",
  ]) {
    assert.ok(workspaceSource.includes(field));
  }
  assert.ok(workspaceSource.includes("saveWorkspacePreference(currentWorkspacePreference)"));
  assert.ok(workspaceSource.includes("window.localStorage.removeItem(legacyStorageKey)"));
});
