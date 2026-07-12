import "dotenv/config";
import { prisma } from "../src/lib/db";
import { DEMO_USER_ID } from "../src/lib/demo";

const PROJECT_IDS = [
  "demo-project-gameplay",
  "demo-project-world",
  "demo-project-art",
  "demo-project-platform",
  "demo-project-release",
];

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Demo data verification failed: ${message}`);
}

function startOfUtcDay(value = new Date()) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function verify() {
  const tasks = await prisma.workItem.findMany({
    where: { projectId: { in: PROJECT_IDS }, sourceTable: "work_item", deletedAt: null },
    select: {
      id: true,
      assigneeId: true,
      startDate: true,
      dueDate: true,
      status: { select: { category: true } },
    },
  });
  const today = startOfUtcDay();
  const tomorrow = addDays(today, 1);
  const plus7 = addDays(today, 8);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const dueByToday = tasks.filter((task) => task.dueDate && task.dueDate < tomorrow);
  const overdue = tasks.filter((task) => task.dueDate && task.dueDate < today && task.status.category !== "DONE");
  const next7 = tasks.filter((task) => task.dueDate && task.dueDate >= tomorrow && task.dueDate < plus7);
  const unplanned = tasks.filter((task) => !task.dueDate);
  const done = tasks.filter((task) => task.status.category === "DONE");
  const calendarMonth = tasks.filter((task) =>
    (task.startDate && task.startDate >= monthStart && task.startDate < monthEnd)
    || (task.dueDate && task.dueDate >= monthStart && task.dueDate < monthEnd));
  const assignees = new Set(tasks.map((task) => task.assigneeId).filter(Boolean));
  const viewerTasks = tasks.filter((task) => task.assigneeId === DEMO_USER_ID);
  const otherAssigneeTasks = tasks.filter((task) => task.assigneeId && task.assigneeId !== DEMO_USER_ID);
  const viewerBuckets = {
    dueByToday: viewerTasks.filter((task) => task.dueDate && task.dueDate < tomorrow).length,
    overdue: viewerTasks.filter((task) => task.dueDate && task.dueDate < today && task.status.category !== "DONE").length,
    next7: viewerTasks.filter((task) => task.dueDate && task.dueDate >= tomorrow && task.dueDate < plus7).length,
    unplanned: viewerTasks.filter((task) => !task.dueDate).length,
    done: viewerTasks.filter((task) => task.status.category === "DONE").length,
  };

  const [savedViews, projectActivities, groupActivities, cycleValues, comments, histories, cycles] = await Promise.all([
    prisma.savedView.findMany({ where: { id: { startsWith: "demo-saved-view-" }, deletedAt: null }, select: { workspaceKey: true, config: true } }),
    prisma.projectActivity.findMany({ where: { id: { startsWith: "demo-activity-" } }, select: { kind: true, actorId: true, createdAt: true } }),
    prisma.projectGroupActivity.findMany({ where: { id: { startsWith: "demo-group-activity-" } }, select: { kind: true, actorId: true, createdAt: true } }),
    prisma.fieldValue.findMany({ where: { objectType: "work_item", fieldId: "demo-field-cycle", objectId: { in: tasks.map((task) => task.id) } }, select: { value: true } }),
    prisma.workItemComment.count({ where: { workItemId: { in: tasks.map((task) => task.id) } } }),
    prisma.workItemHistory.count({ where: { workItemId: { in: tasks.map((task) => task.id) } } }),
    prisma.cycle.count({ where: { id: { startsWith: "demo-cycle-" }, deletedAt: null } }),
  ]);
  const activities = [...projectActivities, ...groupActivities];
  const activityKinds = new Set(activities.map((item) => item.kind));
  const activityActors = new Set(activities.map((item) => item.actorId).filter(Boolean));
  const activityDays = new Set(activities.map((item) => item.createdAt.toISOString().slice(0, 10)));
  const cycleReferences = new Set(cycleValues.map((entry) => JSON.parse(entry.value) as string));
  const savedViewModes = new Set(savedViews.map((view) => (JSON.parse(view.config) as { viewMode?: string }).viewMode));
  const savedViewScopes = new Set(savedViews.map((view) => view.workspaceKey.split(":").slice(0, 2).join(":")));

  invariant(tasks.length === 90, `expected 90 work items, found ${tasks.length}`);
  invariant(assignees.size >= 12, `expected 12 assignees, found ${assignees.size}`);
  invariant(viewerTasks.length >= 25, `expected at least 25 Viewer tasks, found ${viewerTasks.length}`);
  invariant(otherAssigneeTasks.length >= 60, `expected at least 60 non-Viewer tasks, found ${otherAssigneeTasks.length}`);
  for (const [bucket, count] of Object.entries(viewerBuckets)) invariant(count >= 5, `expected at least 5 Viewer tasks in ${bucket}, found ${count}`);
  invariant(dueByToday.length >= 25, `expected at least 25 due-by-today tasks, found ${dueByToday.length}`);
  invariant(overdue.length >= 15, `expected at least 15 unfinished overdue tasks, found ${overdue.length}`);
  invariant(next7.length >= 15, `expected at least 15 next-seven-day tasks, found ${next7.length}`);
  invariant(unplanned.length >= 10, `expected at least 10 unplanned tasks, found ${unplanned.length}`);
  invariant(done.length >= 15, `expected at least 15 done tasks, found ${done.length}`);
  invariant(calendarMonth.length >= 45, `expected at least 45 current-month calendar tasks, found ${calendarMonth.length}`);
  invariant(savedViews.length >= 18, `expected at least 18 saved views, found ${savedViews.length}`);
  invariant(savedViewScopes.has("tasks:my") && savedViewScopes.has("tasks:all") && savedViews.some((view) => view.workspaceKey.startsWith("tasks:group:")) && savedViews.some((view) => view.workspaceKey.startsWith("tasks:project:")), "saved views do not cover my/all/group/project scopes");
  for (const mode of ["list", "grid", "kanban", "calendar", "gantt"]) invariant(savedViewModes.has(mode), `missing ${mode} saved view`);
  invariant(activities.length >= 120, `expected at least 120 activity entries, found ${activities.length}`);
  invariant(activityKinds.size >= 8, `expected at least 8 activity kinds, found ${activityKinds.size}`);
  invariant(activityActors.size >= 10, `expected at least 10 activity actors, found ${activityActors.size}`);
  invariant(activityDays.size >= 20, `expected at least 20 activity dates, found ${activityDays.size}`);
  invariant(cycles === 6, `expected 6 cycles, found ${cycles}`);
  invariant(cycleValues.length === 90, `expected cycle values for all tasks, found ${cycleValues.length}`);
  invariant(cycleReferences.size === 6, `expected references across 6 cycles, found ${cycleReferences.size}`);
  invariant(comments >= 35, `expected at least 35 comments, found ${comments}`);
  invariant(histories >= 270, `expected at least 270 history entries, found ${histories}`);

  console.log(JSON.stringify({
    tasks: tasks.length,
    assignees: assignees.size,
    viewerTasks: viewerTasks.length,
    viewerBuckets,
    otherAssigneeTasks: otherAssigneeTasks.length,
    today: { dueByToday: dueByToday.length, overdue: overdue.length, next7: next7.length, unplanned: unplanned.length, done: done.length },
    calendarMonth: calendarMonth.length,
    savedViews: savedViews.length,
    activity: { entries: activities.length, kinds: activityKinds.size, actors: activityActors.size, days: activityDays.size },
    cycles: { count: cycles, assignedTasks: cycleValues.length, references: cycleReferences.size },
    comments,
    histories,
  }, null, 2));
}

verify()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
