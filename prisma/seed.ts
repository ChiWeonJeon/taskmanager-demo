import "dotenv/config";
import { prisma } from "../src/lib/db";
import { DEMO_USER_EMAIL, DEMO_USER_ID } from "../src/lib/demo";

const GROUP_ID = "demo-group-game-production";
const FIELD_SCHEMA_ID = "demo-schema-work-item";
const CYCLE_FIELD_SCHEMA_ID = "demo-schema-cycle";
const STATUS_SCHEMA_ID = "demo-status-schema-work-item";
const CYCLE_STATUS_SCHEMA_ID = "demo-status-schema-cycle";
const VIEWER_ROLE_ID = "demo-role-viewer";

const users = [
  [DEMO_USER_ID, "Demo Viewer", "Viewer"],
  ["demo-user-producer", "Mina Park", "Producer"],
  ["demo-user-director", "Alex Chen", "Director"],
  ["demo-user-gameplay", "Jordan Lee", "Gameplay"],
  ["demo-user-art", "Sofia Ramirez", "Art"],
  ["demo-user-narrative", "Noah Williams", "Narrative"],
  ["demo-user-online", "Priya Shah", "Online"],
  ["demo-user-qa", "Liam Thompson", "QA"],
] as const;

const projects = [
  ["demo-project-gameplay", "Core Gameplay", "GAME", "Combat, traversal, camera, AI, and player progression."],
  ["demo-project-world", "Open World & Missions", "WORLD", "World streaming, quests, encounters, and narrative systems."],
  ["demo-project-art", "Art, Audio & Cinematics", "ART", "Characters, environments, cinematics, animation, and audio."],
  ["demo-project-platform", "Online, Engine & Platform", "TECH", "Engine, online co-op, builds, telemetry, and platform performance."],
  ["demo-project-release", "QA, Certification & Release", "SHIP", "Quality, localization, ratings, certification, and launch readiness."],
] as const;

const taskTitles = [
  [
    "Finalize heavy-weapon combat loop", "Tune stamina recovery after perfect dodge", "Implement phase-three boss behavior tree",
    "Resolve camera collision in narrow ruins", "Add adaptive aim-assist profiles", "Profile crowd combat at 60 FPS",
    "Integrate haptic feedback for elemental attacks", "Review accessibility presets for combat", "Fix companion revive state desync",
    "Polish aerial traversal transitions", "Validate progression curve for chapter one", "Document gameplay vertical-slice exit criteria",
  ],
  [
    "Lock northern frontier streaming cells", "Author branching outcome for the Sunken Archive", "Fix quest marker after fast travel",
    "Balance dynamic encounter density", "Complete faction reputation narrative pass", "Optimize foliage streaming budget",
    "Integrate world-state persistence", "Review landmark readability from long distance", "Fix NPC schedule at midnight boundary",
    "Localize critical-path quest strings", "Validate mount navigation across bridges", "Prepare content-complete mission audit",
  ],
  [
    "Approve hero armor material library", "Complete antagonist facial animation pass", "Mix siege cinematic in 7.1.4",
    "Fix cloth simulation during traversal", "Deliver biome lighting benchmark scenes", "Integrate final mocap cleanup batch",
    "Review accessibility subtitle presentation", "Optimize cinematic memory residency", "Create destruction VFX performance tiers",
    "Lock orchestral combat stems", "Validate photo-mode character poses", "Archive source assets for content complete",
  ],
  [
    "Stabilize four-player session migration", "Reduce shader compilation hitch on console", "Fix telemetry event duplication",
    "Validate cross-play entitlement flow", "Optimize world partition IO queue", "Complete PS5 performance mode capture",
    "Investigate Xbox suspend-resume failure", "Add build provenance to crash reports", "Harden matchmaking retry policy",
    "Run PC ultra-wide compatibility pass", "Finalize day-one patch branch strategy", "Document gold-master build pipeline",
  ],
  [
    "Triage release-blocking regression suite", "Complete platform terminology audit", "Prepare ratings-board evidence package",
    "Verify save compatibility across patch upgrade", "Run 100-hour soak test", "Close localization LQA severity-one defects",
    "Validate offline-first-launch behavior", "Review privacy and telemetry consent copy", "Certify accessibility compliance matrix",
    "Rehearse launch-day incident response", "Approve known-issues publication list", "Sign off gold-master candidate",
  ],
] as const;

const statuses = [
  ["demo-status-open", "Open", "open", "TODO", "#6b7280"],
  ["demo-status-progress", "In Progress", "in_progress", "IN_PROGRESS", "#3b82f6"],
  ["demo-status-done", "Done", "done", "DONE", "#22c55e"],
] as const;

const customFields = [
  ["demo-field-priority", "Priority", "priority", "SELECT", [{ value: "critical", label: "Critical", color: "#dc2626" }, { value: "high", label: "High", color: "#f97316" }, { value: "medium", label: "Medium", color: "#3b82f6" }, { value: "low", label: "Low", color: "#6b7280" }]],
  ["demo-field-discipline", "Discipline", "discipline", "SELECT", [{ value: "design", label: "Design" }, { value: "engineering", label: "Engineering" }, { value: "art", label: "Art" }, { value: "production", label: "Production" }, { value: "qa", label: "QA" }]],
  ["demo-field-platform", "Platform", "platform", "MULTI_SELECT", [{ value: "ps5", label: "PS5" }, { value: "xbox", label: "Xbox Series" }, { value: "pc", label: "PC" }]],
  ["demo-field-milestone", "Milestone", "milestone", "SELECT", [{ value: "vertical_slice", label: "Vertical Slice" }, { value: "alpha", label: "Alpha" }, { value: "content_complete", label: "Content Complete" }, { value: "beta", label: "Beta & Certification" }, { value: "gold", label: "Gold Master" }]],
  ["demo-field-risk", "Risk", "risk", "SELECT", [{ value: "red", label: "Red", color: "#dc2626" }, { value: "amber", label: "Amber", color: "#f59e0b" }, { value: "green", label: "Green", color: "#22c55e" }]],
  ["demo-field-build", "Target Build", "target_build", "TEXT", []],
] as const;

function dateAt(offsetDays: number) {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value;
}

async function seed() {
  for (const [id, name, shortName] of users) {
    const email = id === DEMO_USER_ID ? DEMO_USER_EMAIL : `${id.replace("demo-user-", "")}@aetherfall.example`;
    await prisma.user.upsert({
      where: { id },
      update: { name, shortName, email, role: "USER", avatarUpdatedAt: null },
      create: { id, name, shortName, email, password: "disabled-public-demo", role: "USER" },
    });
  }

  for (const [id, name, key, category, color] of statuses) {
    await prisma.status.upsert({ where: { id }, update: { name, key, category, color }, create: { id, name, key, category, color, isSystem: true } });
  }
  await prisma.statusSchema.upsert({ where: { id: STATUS_SCHEMA_ID }, update: { name: "Aetherfall Production Workflow", startStatusId: statuses[0][0] }, create: { id: STATUS_SCHEMA_ID, name: "Aetherfall Production Workflow", startStatusId: statuses[0][0] } });
  for (const [index, status] of statuses.entries()) {
    await prisma.statusSchemaStatus.upsert({ where: { statusSchemaId_statusId: { statusSchemaId: STATUS_SCHEMA_ID, statusId: status[0] } }, update: { sortOrder: index }, create: { statusSchemaId: STATUS_SCHEMA_ID, statusId: status[0], sortOrder: index } });
  }

  await prisma.fieldSchema.upsert({ where: { id: FIELD_SCHEMA_ID }, update: { name: "Aetherfall Work Item Schema" }, create: { id: FIELD_SCHEMA_ID, name: "Aetherfall Work Item Schema" } });
  const systemFields = [
    ["demo-field-title", "Title", "title", "TEXT", true], ["demo-field-project", "Project", "project", "TEXT", true],
    ["demo-field-status", "Status", "status", "SELECT", true], ["demo-field-assignee", "Assignee", "assignee", "USER", false],
    ["demo-field-description", "Description", "description", "TEXT", false], ["demo-field-start", "Start date", "start_date", "DATE", false],
    ["demo-field-due", "Due date", "due_date", "DATE", false], ["demo-field-cycle", "Cycle", "cycle", "ENTITY_REF", false],
  ] as const;
  const allFields: { id: string; key: string }[] = [];
  for (const [id, name, key, type, required] of systemFields) {
    const field = await prisma.field.upsert({ where: { id }, update: { name, key, type, isSystem: true, isRequired: required }, create: { id, name, key, type, isSystem: true, isRequired: required, referenceObjectKey: key === "cycle" ? "cycle" : null } });
    allFields.push(field);
  }
  for (const [id, name, key, type, options] of customFields) {
    const field = await prisma.field.upsert({ where: { id }, update: { name, key, type, options: JSON.stringify(options), isSystem: false }, create: { id, name, key, type, options: JSON.stringify(options), isSystem: false } });
    allFields.push(field);
  }
  for (const [index, field] of allFields.entries()) {
    await prisma.fieldSchemaField.upsert({ where: { fieldSchemaId_fieldId: { fieldSchemaId: FIELD_SCHEMA_ID, fieldId: field.id } }, update: { sortOrder: index }, create: { fieldSchemaId: FIELD_SCHEMA_ID, fieldId: field.id, sortOrder: index, isRequired: index < 3 } });
  }

  const issueTypes = [
    ["demo-type-task", "task", "Task", "check-square", "#3b82f6"],
    ["demo-type-story", "story", "Story", "book-open", "#8b5cf6"],
    ["demo-type-bug", "bug", "Bug", "bug", "#ef4444"],
  ] as const;
  for (const [id, key, name, icon, color] of issueTypes) {
    await prisma.issueType.upsert({ where: { id }, update: { key, name, icon, color, fieldSchemaId: FIELD_SCHEMA_ID, statusSchemaId: STATUS_SCHEMA_ID }, create: { id, key, name, category: "ISSUE", icon, color, fieldSchemaId: FIELD_SCHEMA_ID, statusSchemaId: STATUS_SCHEMA_ID, allowedViews: JSON.stringify(["list", "grid", "kanban", "calendar", "gantt"]), isSystem: true } });
  }

  await prisma.fieldSchema.upsert({ where: { id: CYCLE_FIELD_SCHEMA_ID }, update: { name: "Aetherfall Milestone Schema" }, create: { id: CYCLE_FIELD_SCHEMA_ID, name: "Aetherfall Milestone Schema" } });
  const cycleStatuses = [
    ["demo-cycle-status-open", "Planned", "cycle_open", "TODO", "#6b7280"],
    ["demo-cycle-status-active", "Active", "cycle_active", "IN_PROGRESS", "#14b8a6"],
    ["demo-cycle-status-closed", "Complete", "cycle_done", "DONE", "#22c55e"],
  ] as const;
  for (const [id, name, key, category, color] of cycleStatuses) await prisma.status.upsert({ where: { id }, update: { name, key, category, color }, create: { id, name, key, category, color, isSystem: true } });
  await prisma.statusSchema.upsert({ where: { id: CYCLE_STATUS_SCHEMA_ID }, update: { name: "Aetherfall Milestone Workflow", startStatusId: cycleStatuses[0][0] }, create: { id: CYCLE_STATUS_SCHEMA_ID, name: "Aetherfall Milestone Workflow", startStatusId: cycleStatuses[0][0] } });
  for (const [index, status] of cycleStatuses.entries()) await prisma.statusSchemaStatus.upsert({ where: { statusSchemaId_statusId: { statusSchemaId: CYCLE_STATUS_SCHEMA_ID, statusId: status[0] } }, update: { sortOrder: index }, create: { statusSchemaId: CYCLE_STATUS_SCHEMA_ID, statusId: status[0], sortOrder: index } });
  await prisma.issueType.upsert({ where: { id: "demo-type-cycle" }, update: { name: "Milestone", key: "milestone", fieldSchemaId: CYCLE_FIELD_SCHEMA_ID, statusSchemaId: CYCLE_STATUS_SCHEMA_ID }, create: { id: "demo-type-cycle", key: "milestone", name: "Milestone", category: "CYCLE", icon: "target", color: "#14b8a6", fieldSchemaId: CYCLE_FIELD_SCHEMA_ID, statusSchemaId: CYCLE_STATUS_SCHEMA_ID, allowedViews: "[]", isSystem: true } });

  await prisma.role.upsert({ where: { id: VIEWER_ROLE_ID }, update: { name: "Viewer", permissions: JSON.stringify(["checklist:read", "cycle:read"]) }, create: { id: VIEWER_ROLE_ID, name: "Viewer", description: "Read-only project access for the public demo.", permissions: JSON.stringify(["checklist:read", "cycle:read"]), isSystem: true, isDefault: true } });
  await prisma.projectGroup.upsert({ where: { id: GROUP_ID }, update: { name: "Game Production", slug: "game-production", ownerId: "demo-user-producer" }, create: { id: GROUP_ID, name: "Game Production", slug: "game-production", description: "Project Aetherfall — a fictional AAA open-world action RPG production portfolio.", ownerId: "demo-user-producer" } });
  await prisma.projectGroupMember.upsert({ where: { groupId_userId: { groupId: GROUP_ID, userId: DEMO_USER_ID } }, update: { roleId: VIEWER_ROLE_ID }, create: { id: "demo-group-member-viewer", groupId: GROUP_ID, userId: DEMO_USER_ID, roleId: VIEWER_ROLE_ID } });
  await prisma.savedView.deleteMany({ where: { createdById: DEMO_USER_ID, name: "__account_workspace_preferences__" } });
  const demoPreference = JSON.stringify({ filters: [], combinator: "AND", sort: [], group: null, columns: {}, columnOrder: [], viewMode: "list", splitHierarchy: false, ganttUnit: "month", calendarUnit: "month", ganttRangeMode: "auto", customGanttRange: { start: "", end: "" }, todayBucket: "byToday", filterMyTasks: false, excludeDone: false });
  for (const [index, workspaceKey] of ["tasks:my:today", "tasks:all:today"].entries()) {
    await prisma.savedView.create({ data: { id: `demo-preference-${index}`, workspaceKey, name: "__account_workspace_preferences__", config: demoPreference, createdById: DEMO_USER_ID } });
  }

  for (const [sortOrder, [id, name, key, description]] of projects.entries()) {
    await prisma.project.upsert({ where: { id }, update: { name, key, description, ownerId: "demo-user-producer", groupId: GROUP_ID, sortOrderInGroup: sortOrder, defaultIssueTypeId: issueTypes[0][0] }, create: { id, name, key, description, ownerId: "demo-user-producer", groupId: GROUP_ID, sortOrderInGroup: sortOrder, defaultIssueTypeId: issueTypes[0][0] } });
    await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: id, userId: DEMO_USER_ID } }, update: { roleId: VIEWER_ROLE_ID }, create: { id: `demo-project-member-${sortOrder}`, projectId: id, userId: DEMO_USER_ID, roleId: VIEWER_ROLE_ID, source: "group", groupId: GROUP_ID } });
    for (const type of issueTypes) await prisma.projectIssueType.upsert({ where: { projectId_issueTypeId: { projectId: id, issueTypeId: type[0] } }, update: {}, create: { projectId: id, issueTypeId: type[0] } });
  }

  const milestoneNames = ["Vertical Slice", "First Playable", "Alpha", "Content Complete", "Beta & Certification", "Gold Master"];
  for (const [index, name] of milestoneNames.entries()) {
    const cycleId = `demo-cycle-${index + 1}`;
    await prisma.cycle.upsert({ where: { id: cycleId }, update: { name, statusId: index < 2 ? cycleStatuses[2][0] : index === 2 ? cycleStatuses[1][0] : cycleStatuses[0][0] }, create: { id: cycleId, issueTypeId: "demo-type-cycle", scope: "GROUP", groupId: GROUP_ID, name, statusId: index < 2 ? cycleStatuses[2][0] : index === 2 ? cycleStatuses[1][0] : cycleStatuses[0][0], startDate: dateAt(index * 45 - 120), endDate: dateAt(index * 45 - 80), ownerId: "demo-user-producer", creatorId: "demo-user-producer", updatedById: "demo-user-producer" } });
    for (const project of projects) await prisma.cycleProjectInheritance.upsert({ where: { cycleId_projectId: { cycleId, projectId: project[0] } }, update: { enabled: true }, create: { cycleId, projectId: project[0], enabled: true } });
  }

  const projectIds = projects.map((project) => project[0]);
  const existingItems = await prisma.workItem.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } });
  await prisma.fieldValue.deleteMany({ where: { objectType: "work_item", objectId: { in: existingItems.map((item) => item.id) } } });
  await prisma.projectActivity.deleteMany({ where: { id: { startsWith: "demo-activity-" } } });
  await prisma.workItem.deleteMany({ where: { projectId: { in: projectIds } } });

  const assignees = users.slice(1).map((user) => user[0]);
  let globalIndex = 0;
  for (const [projectIndex, project] of projects.entries()) {
    const projectId = project[0];
    for (const [taskIndex, title] of taskTitles[projectIndex].entries()) {
      globalIndex += 1;
      const id = `demo-work-item-${String(globalIndex).padStart(3, "0")}`;
      const issueNumber = taskIndex + 1;
      const statusId = taskIndex % 5 === 4 ? statuses[2][0] : taskIndex % 3 === 1 ? statuses[1][0] : statuses[0][0];
      const typeId = taskIndex % 4 === 0 ? issueTypes[1][0] : taskIndex % 4 === 2 ? issueTypes[2][0] : issueTypes[0][0];
      const assigneeId = taskIndex < 2 ? DEMO_USER_ID : assignees[(globalIndex + projectIndex) % assignees.length];
      const dueOffset = taskIndex < 3 ? -21 + taskIndex * 5 : taskIndex * 7 - 14;
      await prisma.workItem.create({ data: { id, issueKey: `${project[2]}-${issueNumber}`, title, description: `Project Aetherfall production item for ${project[1]}. This synthetic record demonstrates cross-discipline planning, milestone risk, and release visibility.`, startDate: dateAt(dueOffset - 14), dueDate: dateAt(dueOffset), issueTypeId: typeId, statusId, projectId, creatorId: "demo-user-producer", assigneeId, sourceTable: "work_item" } });
      await prisma.workItemProjectIssueKey.create({ data: { id: `demo-context-key-${globalIndex}`, workItemId: id, projectId, issueNumber } });
      const values = [
        [customFields[0][0], JSON.stringify(taskIndex < 3 ? "critical" : taskIndex % 3 === 0 ? "high" : "medium")],
        [customFields[1][0], JSON.stringify(projectIndex === 2 ? "art" : projectIndex === 4 ? "qa" : projectIndex === 0 || projectIndex === 1 ? "design" : "engineering")],
        [customFields[2][0], JSON.stringify(["ps5", "xbox", "pc"].slice(0, 1 + (taskIndex % 3)))],
        [customFields[3][0], JSON.stringify(taskIndex < 2 ? "alpha" : taskIndex < 7 ? "content_complete" : "beta")],
        [customFields[4][0], JSON.stringify(taskIndex < 3 ? "red" : taskIndex % 3 === 0 ? "amber" : "green")],
        [customFields[5][0], JSON.stringify(`AF-${2400 + globalIndex}`)],
      ] as const;
      for (const [fieldId, value] of values) await prisma.fieldValue.create({ data: { id: `${id}-${fieldId}`, objectType: "work_item", objectId: id, fieldId, value } });
      await prisma.workItemHistory.create({ data: { id: `demo-history-${globalIndex}`, workItemId: id, field: "status", before: null, after: statusId, actorId: "demo-user-producer", createdAt: dateAt(-30 + taskIndex) } });
      if (taskIndex < 2) await prisma.workItemComment.create({ data: { id: `demo-comment-${globalIndex}`, workItemId: id, body: taskIndex === 0 ? "Milestone review flagged this as a cross-team dependency. Keep the exit criteria visible in the next production sync." : "Latest build evidence is attached to the internal review package; the public demo contains no real assets.", authorId: assigneeId, createdAt: dateAt(-5 + taskIndex) } });
      if (taskIndex < 3) await prisma.workItemWatcher.create({ data: { id: `demo-watcher-${globalIndex}`, workItemId: id, userId: "demo-user-producer", source: "manual", addedById: assigneeId } });
      await prisma.projectActivity.create({ data: { id: `demo-activity-${globalIndex}`, projectId, actorId: assigneeId, kind: taskIndex % 5 === 4 ? "workitem.completed" : "workitem.updated", subjectType: "work_item", subjectId: id, payload: JSON.stringify({ title, synthetic: true }), createdAt: dateAt(-20 + taskIndex) } });
    }
    await prisma.projectIssueCounter.upsert({ where: { projectId }, update: { current: 12 }, create: { projectId, current: 12 } });
  }

  const checklistId = "demo-checklist-certification";
  await prisma.checklist.upsert({ where: { id: checklistId }, update: { title: "Gold Master Readiness Gate" }, create: { id: checklistId, projectId: projects[4][0], title: "Gold Master Readiness Gate", description: "Synthetic release checklist for platform certification and launch readiness.", createdById: "demo-user-qa", sortOrder: 0 } });
  const checklistGroups = [["demo-check-group-build", "Build Integrity"], ["demo-check-group-cert", "Certification"], ["demo-check-group-launch", "Launch Operations"]] as const;
  for (const [index, [id, name]] of checklistGroups.entries()) await prisma.checklistItemGroup.upsert({ where: { id }, update: { name, sortOrder: index }, create: { id, checklistId, name, sortOrder: index } });
  const checklistItems = [
    ["demo-check-1", checklistGroups[0][0], "Verify deterministic build provenance"], ["demo-check-2", checklistGroups[0][0], "Complete 100-hour stability soak"],
    ["demo-check-3", checklistGroups[1][0], "Close severity-one platform findings"], ["demo-check-4", checklistGroups[1][0], "Approve terminology and privacy matrices"],
    ["demo-check-5", checklistGroups[2][0], "Rehearse launch incident escalation"], ["demo-check-6", checklistGroups[2][0], "Publish synthetic known-issues brief"],
  ] as const;
  for (const [index, [id, groupId, content]] of checklistItems.entries()) await prisma.checklistItem.upsert({ where: { id }, update: { groupId, content, sortOrder: index }, create: { id, checklistId, groupId, content, sortOrder: index } });

  console.log(`Seeded Project Aetherfall with ${globalIndex} work items across ${projects.length} projects.`);
}

seed().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
