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
  ["demo-user-producer", "Mina Park", "Executive Producer"],
  ["demo-user-director", "Alex Chen", "Game Director"],
  ["demo-user-gameplay", "Jordan Lee", "Lead Gameplay Engineer"],
  ["demo-user-art", "Sofia Ramirez", "Technical Art Director"],
  ["demo-user-narrative", "Noah Williams", "Narrative Lead"],
  ["demo-user-online", "Priya Shah", "Online Lead"],
  ["demo-user-qa", "Liam Thompson", "QA Lead"],
  ["demo-user-cinematics", "Emi Tanaka", "Cinematics Director"],
  ["demo-user-audio", "Marcus Johnson", "Audio Director"],
  ["demo-user-platform", "Elena Petrova", "Platform Lead"],
  ["demo-user-release", "Daniel Kim", "Release Manager"],
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
    "Prototype shield-parry readability pass", "Benchmark enemy perception under load", "Tune controller dead-zone presets",
    "Fix lock-on target swap near elevation changes", "Review combat tutorial telemetry", "Prepare first-playable gameplay review",
  ],
  [
    "Lock northern frontier streaming cells", "Author branching outcome for the Sunken Archive", "Fix quest marker after fast travel",
    "Balance dynamic encounter density", "Complete faction reputation narrative pass", "Optimize foliage streaming budget",
    "Integrate world-state persistence", "Review landmark readability from long distance", "Fix NPC schedule at midnight boundary",
    "Localize critical-path quest strings", "Validate mount navigation across bridges", "Prepare content-complete mission audit",
    "Stage volcanic biome encounter chain", "Resolve streaming seam at capital gate", "Audit ambient NPC barks by district",
    "Validate quest fail-state recovery", "Tune weather-driven traversal hazards", "Prepare alpha world-content scorecard",
  ],
  [
    "Approve hero armor material library", "Complete antagonist facial animation pass", "Mix siege cinematic in 7.1.4",
    "Fix cloth simulation during traversal", "Deliver biome lighting benchmark scenes", "Integrate final mocap cleanup batch",
    "Review accessibility subtitle presentation", "Optimize cinematic memory residency", "Create destruction VFX performance tiers",
    "Lock orchestral combat stems", "Validate photo-mode character poses", "Archive source assets for content complete",
    "Finalize creature vocalization palette", "Polish hero landing animation variants", "Review HDR cinematic grade consistency",
    "Optimize crowd cloth LOD transitions", "Mix open-world exploration stems", "Prepare art content-complete reel",
  ],
  [
    "Stabilize four-player session migration", "Reduce shader compilation hitch on console", "Fix telemetry event duplication",
    "Validate cross-play entitlement flow", "Optimize world partition IO queue", "Complete PS5 performance mode capture",
    "Investigate Xbox suspend-resume failure", "Add build provenance to crash reports", "Harden matchmaking retry policy",
    "Run PC ultra-wide compatibility pass", "Finalize day-one patch branch strategy", "Document gold-master build pipeline",
    "Profile server tick variance under load", "Validate Steam Deck fallback profile", "Reduce patch delta generation time",
    "Harden cross-region party reconnection", "Audit console crash symbol coverage", "Prepare beta operations readiness review",
  ],
  [
    "Triage release-blocking regression suite", "Complete platform terminology audit", "Prepare ratings-board evidence package",
    "Verify save compatibility across patch upgrade", "Run 100-hour soak test", "Close localization LQA severity-one defects",
    "Validate offline-first-launch behavior", "Review privacy and telemetry consent copy", "Certify accessibility compliance matrix",
    "Rehearse launch-day incident response", "Approve known-issues publication list", "Sign off gold-master candidate",
    "Validate regional age-rating descriptors", "Run multilingual first-boot smoke test", "Audit storefront metadata package",
    "Exercise rollback communication tree", "Close accessibility certification evidence", "Prepare launch command-center schedule",
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
  ["demo-field-milestone", "Milestone", "milestone", "SELECT", [{ value: "vertical_slice", label: "Vertical Slice" }, { value: "first_playable", label: "First Playable" }, { value: "alpha", label: "Alpha" }, { value: "content_complete", label: "Content Complete" }, { value: "beta", label: "Beta & Certification" }, { value: "gold", label: "Gold Master" }]],
  ["demo-field-risk", "Risk", "risk", "SELECT", [{ value: "red", label: "Red", color: "#dc2626" }, { value: "amber", label: "Amber", color: "#f59e0b" }, { value: "green", label: "Green", color: "#22c55e" }]],
  ["demo-field-build", "Target Build", "target_build", "TEXT", []],
] as const;

function dateAt(offsetDays: number) {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value;
}

function timestampAt(offsetDays: number, hour: number, minute = 0) {
  const value = dateAt(offsetDays);
  value.setUTCHours(hour, minute, 0, 0);
  return value;
}

function dateKey(offsetDays: number) {
  return dateAt(offsetDays).toISOString().slice(0, 10);
}

function demoWorkItemId(index: number) {
  return `demo-work-item-${String(index).padStart(3, "0")}`;
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
  for (const [index, [userId]] of users.entries()) {
    await prisma.projectGroupMember.upsert({
      where: { groupId_userId: { groupId: GROUP_ID, userId } },
      update: { roleId: VIEWER_ROLE_ID },
      create: { id: `demo-group-member-${index}`, groupId: GROUP_ID, userId, roleId: VIEWER_ROLE_ID },
    });
  }

  await prisma.savedView.deleteMany({ where: { OR: [{ id: { startsWith: "demo-saved-view-" } }, { createdById: DEMO_USER_ID, name: "__account_workspace_preferences__" }] } });
  const demoPreference = JSON.stringify({ filters: [], combinator: "AND", sort: [], group: null, columns: {}, columnOrder: [], viewMode: "list", splitHierarchy: false, ganttUnit: "month", calendarUnit: "month", ganttRangeMode: "auto", customGanttRange: { start: "", end: "" }, todayBucket: "byToday", filterMyTasks: false, excludeDone: false });
  for (const [index, workspaceKey] of ["tasks:my:today", "tasks:my", "tasks:all:today", "tasks:all"].entries()) {
    await prisma.savedView.create({ data: { id: `demo-preference-${index}`, workspaceKey, name: "__account_workspace_preferences__", config: demoPreference, createdById: DEMO_USER_ID } });
  }

  const savedViews = [
    ["my-overdue", "tasks:my:today", "My overdue blockers", { filters: [{ id: "risk", field: "demo-field-risk", operator: "in", value: ["red"] }], combinator: "AND", sort: [{ id: "due", field: "dueDate", direction: "asc" }], group: "project", columns: {}, columnOrder: [], viewMode: "list" }],
    ["studio-triage", "tasks:all:today", "Studio triage by assignee", { filters: [{ id: "priority", field: "demo-field-priority", operator: "in", value: ["critical", "high"] }], combinator: "AND", sort: [{ id: "due", field: "dueDate", direction: "asc" }], group: "assignee", columns: {}, columnOrder: [], viewMode: "list" }],
    ["cross-platform-bugs", "tasks:all", "Cross-platform bugs", { filters: [{ id: "type", field: "issueType", operator: "in", value: ["demo-type-bug"] }, { id: "platform", field: "demo-field-platform", operator: "in", value: ["ps5", "xbox"] }], combinator: "AND", sort: [{ id: "updated", field: "updatedAt", direction: "desc" }], group: "project", columns: {}, columnOrder: [], viewMode: "grid" }],
    ["milestone-calendar", "tasks:all", "Milestone calendar", { filters: [{ id: "window", field: "dueDate", operator: "between", value: dateKey(-14), value2: dateKey(45) }], combinator: "AND", sort: [{ id: "start", field: "startDate", direction: "asc" }], group: null, columns: {}, columnOrder: [], viewMode: "calendar", calendarUnit: "month" }],
    ["cycle-board", "tasks:all", "Cycle delivery board", { filters: [{ id: "cycle", field: "demo-field-cycle", operator: "is_not_empty", value: "" }], combinator: "AND", sort: [{ id: "due", field: "dueDate", direction: "asc" }], group: "status", columns: {}, columnOrder: [], viewMode: "kanban" }],
    ["release-gantt", "tasks:all", "Release readiness Gantt", { filters: [{ id: "project", field: "project", operator: "in", value: ["demo-project-release"] }], combinator: "AND", sort: [{ id: "start", field: "startDate", direction: "asc" }], group: "assignee", columns: {}, columnOrder: [], viewMode: "gantt", ganttUnit: "week" }],
    ["group-calendar", `tasks:group:${GROUP_ID}`, "Production milestone calendar", { filters: [], combinator: "AND", sort: [{ id: "start", field: "startDate", direction: "asc" }], group: "project", columns: {}, columnOrder: [], viewMode: "calendar", calendarUnit: "month" }],
    ["group-risks", `tasks:group:${GROUP_ID}:today`, "Game Production risks", { filters: [{ id: "risk", field: "demo-field-risk", operator: "in", value: ["red", "amber"] }], combinator: "AND", sort: [{ id: "due", field: "dueDate", direction: "asc" }], group: "project", columns: {}, columnOrder: [], viewMode: "list" }],
  ] as const;
  for (const [id, workspaceKey, name, config] of savedViews) {
    await prisma.savedView.create({ data: { id: `demo-saved-view-${id}`, workspaceKey, name, isShared: true, config: JSON.stringify(config), createdById: "demo-user-producer" } });
  }

  for (const [sortOrder, [id, name, key, description]] of projects.entries()) {
    await prisma.project.upsert({ where: { id }, update: { name, key, description, ownerId: "demo-user-producer", groupId: GROUP_ID, sortOrderInGroup: sortOrder, defaultIssueTypeId: issueTypes[0][0] }, create: { id, name, key, description, ownerId: "demo-user-producer", groupId: GROUP_ID, sortOrderInGroup: sortOrder, defaultIssueTypeId: issueTypes[0][0] } });
    for (const [userIndex, [userId]] of users.entries()) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: id, userId } },
        update: { roleId: VIEWER_ROLE_ID, source: "group", groupId: GROUP_ID },
        create: { id: `demo-project-member-${sortOrder}-${userIndex}`, projectId: id, userId, roleId: VIEWER_ROLE_ID, source: "group", groupId: GROUP_ID },
      });
    }
    for (const type of issueTypes) await prisma.projectIssueType.upsert({ where: { projectId_issueTypeId: { projectId: id, issueTypeId: type[0] } }, update: {}, create: { projectId: id, issueTypeId: type[0] } });
    for (const [suffix, variant, viewMode] of [["calendar", "", "calendar"], ["today", ":today", "list"]] as const) {
      await prisma.savedView.create({
        data: {
          id: `demo-saved-view-${key.toLowerCase()}-${suffix}`,
          workspaceKey: `tasks:project:${id}${variant}`,
          name: suffix === "calendar" ? `${name} calendar` : `${name} daily focus`,
          isShared: true,
          config: JSON.stringify({ filters: [], combinator: "AND", sort: [{ id: "due", field: "dueDate", direction: "asc" }], group: suffix === "today" ? "assignee" : null, columns: {}, columnOrder: [], viewMode, ...(viewMode === "calendar" ? { calendarUnit: "month" } : {}) }),
          createdById: "demo-user-producer",
        },
      });
    }
  }

  const milestoneNames = ["Vertical Slice", "First Playable", "Alpha", "Content Complete", "Beta & Certification", "Gold Master"];
  for (const [index, name] of milestoneNames.entries()) {
    const cycleId = `demo-cycle-${index + 1}`;
    const statusId = index < 2 ? cycleStatuses[2][0] : index === 2 ? cycleStatuses[1][0] : cycleStatuses[0][0];
    const startDate = dateAt(index * 45 - 120);
    const endDate = dateAt(index * 45 - 80);
    await prisma.cycle.upsert({
      where: { id: cycleId },
      update: { name, statusId, startDate, endDate, ownerId: users[1 + (index % (users.length - 1))]![0], updatedById: users[2 + (index % (users.length - 2))]![0] },
      create: { id: cycleId, issueTypeId: "demo-type-cycle", scope: "GROUP", groupId: GROUP_ID, name, statusId, startDate, endDate, ownerId: users[1 + (index % (users.length - 1))]![0], creatorId: "demo-user-producer", updatedById: users[2 + (index % (users.length - 2))]![0] },
    });
    for (const project of projects) await prisma.cycleProjectInheritance.upsert({ where: { cycleId_projectId: { cycleId, projectId: project[0] } }, update: { enabled: true }, create: { cycleId, projectId: project[0], enabled: true } });
    for (const commentIndex of [0, 1]) {
      await prisma.cycleComment.upsert({
        where: { id: `demo-cycle-comment-${index}-${commentIndex}` },
        update: { body: commentIndex === 0 ? `${name} exit criteria reviewed with discipline leads.` : `${name} dependency map refreshed for the next production review.`, authorId: users[2 + ((index + commentIndex) % (users.length - 2))]![0], createdAt: timestampAt(-14 + index * 2 + commentIndex, 9 + commentIndex * 5) },
        create: { id: `demo-cycle-comment-${index}-${commentIndex}`, cycleId, body: commentIndex === 0 ? `${name} exit criteria reviewed with discipline leads.` : `${name} dependency map refreshed for the next production review.`, authorId: users[2 + ((index + commentIndex) % (users.length - 2))]![0], createdAt: timestampAt(-14 + index * 2 + commentIndex, 9 + commentIndex * 5) },
      });
    }
    await prisma.cycleHistory.upsert({
      where: { id: `demo-cycle-history-${index}` },
      update: { before: cycleStatuses[0][0], after: statusId, actorId: users[1 + (index % (users.length - 1))]![0], createdAt: timestampAt(-60 + index * 8, 15) },
      create: { id: `demo-cycle-history-${index}`, cycleId, field: "status", before: cycleStatuses[0][0], after: statusId, actorId: users[1 + (index % (users.length - 1))]![0], createdAt: timestampAt(-60 + index * 8, 15) },
    });
    for (const watcherIndex of [0, 1, 2]) {
      const userId = users[(index + watcherIndex + 1) % users.length]![0];
      await prisma.cycleWatcher.upsert({
        where: { cycleId_userId: { cycleId, userId } },
        update: { source: "manual", addedById: "demo-user-producer" },
        create: { id: `demo-cycle-watcher-${index}-${watcherIndex}`, cycleId, userId, source: "manual", addedById: "demo-user-producer" },
      });
    }
  }

  const projectIds = projects.map((project) => project[0]);
  const existingItems = await prisma.workItem.findMany({ where: { projectId: { in: projectIds } }, select: { id: true } });
  await prisma.fieldValue.deleteMany({ where: { objectType: "work_item", objectId: { in: existingItems.map((item) => item.id) } } });
  await prisma.projectActivity.deleteMany({ where: { id: { startsWith: "demo-activity-" } } });
  await prisma.projectGroupActivity.deleteMany({ where: { id: { startsWith: "demo-group-activity-" } } });
  await prisma.workItem.deleteMany({ where: { projectId: { in: projectIds } } });

  const assignees = users.slice(1).map((user) => user[0]);
  const scheduleOffsets = [-45, -21, -7, -3, -1, 0, 1, 3, 5, 7, 14, 21, 30, 45, 60, 90, 0, 10] as const;
  const viewerTaskIndexes = new Set([0, 4, 5, 6, 11]);
  const milestoneKeys = ["vertical_slice", "first_playable", "alpha", "content_complete", "beta", "gold"] as const;
  const activityOffsets = [0, -1, -2, -3, -4, -5, -6, -7, -9, -10, -12, -14, -18, -21, -30, -45, -60, -75, -90, -120, -150, -180] as const;
  let globalIndex = 0;
  for (const [projectIndex, project] of projects.entries()) {
    const projectId = project[0];
    const projectStartIndex = projectIndex * taskTitles[projectIndex].length + 1;
    for (const [taskIndex, title] of taskTitles[projectIndex].entries()) {
      globalIndex += 1;
      const id = demoWorkItemId(globalIndex);
      const issueNumber = taskIndex + 1;
      const statusId = taskIndex % 6 === 4 ? statuses[2][0] : taskIndex % 2 === 0 ? statuses[1][0] : statuses[0][0];
      const typeId = taskIndex % 4 === 0 ? issueTypes[1][0] : taskIndex % 4 === 2 ? issueTypes[2][0] : issueTypes[0][0];
      const assigneeId = viewerTaskIndexes.has(taskIndex) ? DEMO_USER_ID : assignees[(globalIndex + projectIndex) % assignees.length]!;
      const dueOffset = scheduleOffsets[taskIndex]!;
      const startDate = taskIndex === 11 ? null : taskIndex === 17 ? dateAt(10 + projectIndex) : dateAt(dueOffset - (3 + (taskIndex % 9)));
      const dueDate = taskIndex === 11 || taskIndex === 17 ? null : dateAt(dueOffset);
      const parentId = taskIndex === 2 || taskIndex === 3
        ? demoWorkItemId(projectStartIndex)
        : taskIndex === 8 || taskIndex === 9
          ? demoWorkItemId(projectStartIndex + 7)
          : null;
      const cycleIndex = (taskIndex + projectIndex) % milestoneNames.length;
      const cycleReference = `entity-record-cycle-demo-cycle-${cycleIndex + 1}`;
      const createdAt = timestampAt(-180 + ((globalIndex * 7) % 170), 8 + (globalIndex % 9), (globalIndex * 11) % 60);
      const updatedAt = timestampAt(activityOffsets[globalIndex % activityOffsets.length]!, 9 + (globalIndex % 8), (globalIndex * 13) % 60);
      await prisma.workItem.create({ data: { id, issueKey: `${project[2]}-${issueNumber}`, title, description: `Project Aetherfall production item for ${project[1]}. This synthetic record demonstrates cross-discipline planning, milestone risk, and release visibility.`, startDate, dueDate, issueTypeId: typeId, statusId, projectId, parentId, creatorId: users[1 + (globalIndex % (users.length - 1))]![0], assigneeId, sourceTable: "work_item", createdAt, updatedAt } });
      await prisma.workItemProjectIssueKey.create({ data: { id: `demo-context-key-${globalIndex}`, workItemId: id, projectId, issueNumber } });
      const values = [
        [customFields[0][0], JSON.stringify(taskIndex < 4 ? "critical" : taskIndex % 5 === 0 ? "high" : taskIndex % 5 === 4 ? "low" : "medium")],
        [customFields[1][0], JSON.stringify(projectIndex === 2 ? "art" : projectIndex === 4 ? "qa" : projectIndex === 0 || projectIndex === 1 ? "design" : "engineering")],
        [customFields[2][0], JSON.stringify(["ps5", "xbox", "pc"].slice(0, 1 + (taskIndex % 3)))],
        [customFields[3][0], JSON.stringify(milestoneKeys[cycleIndex])],
        [customFields[4][0], JSON.stringify(taskIndex < 4 ? "red" : taskIndex % 3 === 0 ? "amber" : "green")],
        [customFields[5][0], JSON.stringify(`AF-${2400 + globalIndex}`)],
        ["demo-field-cycle", JSON.stringify(cycleReference)],
      ] as const;
      for (const [fieldId, value] of values) await prisma.fieldValue.create({ data: { id: `${id}-${fieldId}`, objectType: "work_item", objectId: id, fieldId, value } });
      await prisma.workItemHistory.createMany({ data: [
        { id: `demo-history-${globalIndex}-status`, workItemId: id, field: "status", before: statuses[0][0], after: statusId, actorId: users[1 + ((globalIndex + 1) % (users.length - 1))]![0], createdAt: timestampAt(-45 + (taskIndex % 30), 10) },
        { id: `demo-history-${globalIndex}-assignee`, workItemId: id, field: "assignee", before: null, after: assigneeId, actorId: "demo-user-producer", createdAt: timestampAt(-30 + (taskIndex % 24), 14, 30) },
        { id: `demo-history-${globalIndex}-cycle`, workItemId: id, field: "demo-field-cycle", before: null, after: cycleReference, actorId: users[1 + ((globalIndex + 3) % (users.length - 1))]![0], createdAt: timestampAt(-20 + (taskIndex % 18), 16, 15) },
      ] });
      if (taskIndex < 6 || taskIndex % 7 === 0) await prisma.workItemComment.create({ data: { id: `demo-comment-${globalIndex}`, workItemId: id, body: taskIndex % 2 === 0 ? "Milestone review flagged a cross-team dependency. Keep the exit criteria visible in the next production sync." : "The latest synthetic build evidence has been reviewed by the assigned discipline lead.", authorId: users[1 + ((globalIndex + 2) % (users.length - 1))]![0], createdAt: timestampAt(-12 + (taskIndex % 10), 11 + (taskIndex % 6), (globalIndex * 5) % 60) } });
      for (const watcherOffset of [0, 1]) {
        const watcherId = users[(globalIndex + watcherOffset) % users.length]![0];
        await prisma.workItemWatcher.create({ data: { id: `demo-watcher-${globalIndex}-${watcherOffset}`, workItemId: id, userId: watcherId, source: "manual", addedById: assigneeId } });
      }
      await prisma.projectActivity.create({ data: { id: `demo-activity-${globalIndex}-created`, projectId, actorId: assigneeId, kind: "workitem.created", subjectType: "work_item", subjectId: id, payload: JSON.stringify({ title, issueKey: `${project[2]}-${issueNumber}`, synthetic: true }), createdAt: updatedAt } });
    }
    const projectSignals = [
      ["settings.updated", "project", projectId, { name: `${project[1]} delivery settings` }],
      ["checklist.created", "checklist", "demo-checklist-certification", { title: "Gold Master Readiness Gate" }],
      ["cycle.updated", "cycle", `demo-cycle-${projectIndex + 1}`, { name: milestoneNames[projectIndex + 1] }],
      ["member.added", "user", users[projectIndex + 2]![0], { userName: users[projectIndex + 2]![1] }],
    ] as const;
    for (const [signalIndex, [kind, subjectType, subjectId, payload]] of projectSignals.entries()) {
      await prisma.projectActivity.create({ data: { id: `demo-activity-${projectIndex}-signal-${signalIndex}`, projectId, actorId: users[1 + ((projectIndex + signalIndex) % (users.length - 1))]![0], kind, subjectType, subjectId, payload: JSON.stringify(payload), createdAt: timestampAt([-2, -14, -45, -90][signalIndex]!, 9 + signalIndex * 2, projectIndex * 7) } });
    }
    await prisma.projectIssueCounter.upsert({ where: { projectId }, update: { current: taskTitles[projectIndex].length }, create: { projectId, current: taskTitles[projectIndex].length } });
  }

  const groupSignals = [
    ["project.added", "project", projects[0][0], { name: projects[0][1] }, -180],
    ["project.added", "project", projects[4][0], { name: projects[4][1] }, -150],
    ["member.added", "user", users[8][0], { userName: users[8][1] }, -120],
    ["member.role_changed", "user", users[6][0], { userName: users[6][1] }, -90],
    ["cycle.created", "cycle", "demo-cycle-3", { name: milestoneNames[2] }, -60],
    ["cycle.updated", "cycle", "demo-cycle-4", { name: milestoneNames[3] }, -30],
    ["settings.updated", "group", GROUP_ID, { name: "Game Production planning cadence" }, -14],
    ["checklist.created", "checklist", "demo-checklist-certification", { title: "Gold Master Readiness Gate" }, -7],
    ["project.added", "project", projects[3][0], { name: projects[3][1] }, -3],
    ["cycle.updated", "cycle", "demo-cycle-5", { name: milestoneNames[4] }, -1],
    ["member.added", "user", users[10][0], { userName: users[10][1] }, 0],
    ["settings.updated", "group", GROUP_ID, { name: "Launch command-center roster" }, 0],
  ] as const;
  for (const [index, [kind, subjectType, subjectId, payload, dayOffset]] of groupSignals.entries()) {
    await prisma.projectGroupActivity.create({ data: { id: `demo-group-activity-${index}`, projectGroupId: GROUP_ID, actorId: users[1 + (index % (users.length - 1))]![0], kind, subjectType, subjectId, payload: JSON.stringify(payload), createdAt: timestampAt(dayOffset, 8 + (index % 10), (index * 9) % 60) } });
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
