-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "avatarUpdatedAt" DATETIME,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceObjectKey" TEXT,
    "referenceObjectDefId" TEXT,
    "options" TEXT,
    "defaultValue" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Field_referenceObjectDefId_fkey" FOREIGN KEY ("referenceObjectDefId") REFERENCES "ObjectDef" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "SavedView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FieldSchema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FieldSchemaField" (
    "fieldSchemaId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,

    PRIMARY KEY ("fieldSchemaId", "fieldId"),
    CONSTRAINT "FieldSchemaField_fieldSchemaId_fkey" FOREIGN KEY ("fieldSchemaId") REFERENCES "FieldSchema" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldSchemaField_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusSchema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startStatusId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusSchema_startStatusId_fkey" FOREIGN KEY ("startStatusId") REFERENCES "Status" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statusSchemaId" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusTransition_statusSchemaId_fkey" FOREIGN KEY ("statusSchemaId") REFERENCES "StatusSchema" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "Status" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "Status" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusSchemaStatus" (
    "statusSchemaId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("statusSchemaId", "statusId"),
    CONSTRAINT "StatusSchemaStatus_statusSchemaId_fkey" FOREIGN KEY ("statusSchemaId") REFERENCES "StatusSchema" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StatusSchemaStatus_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ISSUE',
    "icon" TEXT,
    "color" TEXT,
    "fieldSchemaId" TEXT NOT NULL,
    "statusSchemaId" TEXT,
    "allowedViews" TEXT NOT NULL DEFAULT '[]',
    "allowedChildEntityTypeIds" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntityType_fieldSchemaId_fkey" FOREIGN KEY ("fieldSchemaId") REFERENCES "FieldSchema" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntityType_statusSchemaId_fkey" FOREIGN KEY ("statusSchemaId") REFERENCES "StatusSchema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "current" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "EntityRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "descriptionMentions" TEXT NOT NULL DEFAULT '[]',
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "entityTypeId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentId" TEXT,
    "sourceTable" TEXT,
    "sourceId" TEXT,
    "creatorId" TEXT,
    "assigneeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "EntityRecord_entityTypeId_fkey" FOREIGN KEY ("entityTypeId") REFERENCES "EntityType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntityRecord_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntityRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EntityRecord_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EntityRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EntityRecord_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EntityRecord_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectIssueCounter" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "current" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProjectIssueCounter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemProjectIssueKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkItemProjectIssueKey_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemProjectIssueKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "defaultIssueTypeId" TEXT,
    "groupId" TEXT,
    "sortOrderInGroup" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_defaultIssueTypeId_fkey" FOREIGN KEY ("defaultIssueTypeId") REFERENCES "EntityType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectIssueType" (
    "projectId" TEXT NOT NULL,
    "issueTypeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("projectId", "issueTypeId"),
    CONSTRAINT "ProjectIssueType_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectIssueType_issueTypeId_fkey" FOREIGN KEY ("issueTypeId") REFERENCES "EntityType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT NOT NULL DEFAULT '[]',
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkItemComment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkItemHistory_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "WorkItemFieldValue_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegacyFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityKind" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "LegacyFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntityRecordFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityRecordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "EntityRecordFieldValue_entityRecordId_fkey" FOREIGN KEY ("entityRecordId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntityRecordFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObjectDef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "fieldSchemaId" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ObjectDef_fieldSchemaId_fkey" FOREIGN KEY ("fieldSchemaId") REFERENCES "FieldSchema" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObjectRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectDefId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ObjectRecord_objectDefId_fkey" FOREIGN KEY ("objectDefId") REFERENCES "ObjectDef" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ObjectRecord_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ObjectRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObjectRecordFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objectRecordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "ObjectRecordFieldValue_objectRecordId_fkey" FOREIGN KEY ("objectRecordId") REFERENCES "ObjectRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ObjectRecordFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemWatcher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "addedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkItemWatcher_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkItemWatcher_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "actorId" TEXT,
    "workItemId" TEXT,
    "projectId" TEXT,
    "checklistRunId" TEXT,
    "cycleId" TEXT,
    "commentId" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notification_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_checklistRunId_fkey" FOREIGN KEY ("checklistRunId") REFERENCES "ChecklistRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueTypeId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "groupId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "statusId" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "inheritByDefault" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    "creatorId" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Cycle_issueTypeId_fkey" FOREIGN KEY ("issueTypeId") REFERENCES "EntityType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cycle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Cycle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Cycle_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Status" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cycle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cycle_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cycle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CycleProjectInheritance" (
    "cycleId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("cycleId", "projectId"),
    CONSTRAINT "CycleProjectInheritance_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleProjectInheritance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CycleComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT NOT NULL DEFAULT '[]',
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CycleComment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CycleHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CycleHistory_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CycleWatcher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "addedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CycleWatcher_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleWatcher_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CycleRecordMeta" (
    "entityRecordId" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "groupId" TEXT,
    "projectId" TEXT,
    "inheritByDefault" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT,
    CONSTRAINT "CycleRecordMeta_entityRecordId_fkey" FOREIGN KEY ("entityRecordId") REFERENCES "EntityRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleRecordMeta_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleRecordMeta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CycleRecordMeta_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectGroupMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProjectPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "UserProjectPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProjectPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "Checklist_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Checklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItemGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistItemGroup_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "groupId" TEXT,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChecklistItemGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedById" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "ChecklistRun_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistRunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groupName" TEXT,
    "groupSortOrder" INTEGER,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedById" TEXT,
    "checkedAt" DATETIME,
    CONSTRAINT "ChecklistRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRunItem_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "ChecklistItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRunItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistRunEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "itemId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRunEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectGroupActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectGroupId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectGroupActivity_projectGroupId_fkey" FOREIGN KEY ("projectGroupId") REFERENCES "ProjectGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectGroupActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Field_key_key" ON "Field"("key");

-- CreateIndex
CREATE INDEX "Field_referenceObjectDefId_idx" ON "Field"("referenceObjectDefId");

-- CreateIndex
CREATE INDEX "SavedView_workspaceKey_deletedAt_idx" ON "SavedView"("workspaceKey", "deletedAt");

-- CreateIndex
CREATE INDEX "SavedView_createdById_idx" ON "SavedView"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Status_key_key" ON "Status"("key");

-- CreateIndex
CREATE INDEX "StatusSchema_startStatusId_idx" ON "StatusSchema"("startStatusId");

-- CreateIndex
CREATE INDEX "StatusTransition_statusSchemaId_idx" ON "StatusTransition"("statusSchemaId");

-- CreateIndex
CREATE INDEX "StatusTransition_fromStatusId_idx" ON "StatusTransition"("fromStatusId");

-- CreateIndex
CREATE INDEX "StatusTransition_toStatusId_idx" ON "StatusTransition"("toStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "StatusTransition_statusSchemaId_fromStatusId_toStatusId_key" ON "StatusTransition"("statusSchemaId", "fromStatusId", "toStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_key_key" ON "EntityType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_name_key" ON "EntityType"("name");

-- CreateIndex
CREATE INDEX "EntityType_category_idx" ON "EntityType"("category");

-- CreateIndex
CREATE INDEX "EntityType_deletedAt_idx" ON "EntityType"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRecord_recordKey_key" ON "EntityRecord"("recordKey");

-- CreateIndex
CREATE INDEX "EntityRecord_assigneeId_idx" ON "EntityRecord"("assigneeId");

-- CreateIndex
CREATE INDEX "EntityRecord_projectId_idx" ON "EntityRecord"("projectId");

-- CreateIndex
CREATE INDEX "EntityRecord_statusId_idx" ON "EntityRecord"("statusId");

-- CreateIndex
CREATE INDEX "EntityRecord_parentId_idx" ON "EntityRecord"("parentId");

-- CreateIndex
CREATE INDEX "EntityRecord_creatorId_idx" ON "EntityRecord"("creatorId");

-- CreateIndex
CREATE INDEX "EntityRecord_createdAt_idx" ON "EntityRecord"("createdAt");

-- CreateIndex
CREATE INDEX "EntityRecord_deletedAt_idx" ON "EntityRecord"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRecord_sourceTable_sourceId_key" ON "EntityRecord"("sourceTable", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemProjectIssueKey_workItemId_projectId_key" ON "WorkItemProjectIssueKey"("workItemId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemProjectIssueKey_projectId_issueNumber_key" ON "WorkItemProjectIssueKey"("projectId", "issueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_defaultIssueTypeId_idx" ON "Project"("defaultIssueTypeId");

-- CreateIndex
CREATE INDEX "Project_groupId_idx" ON "Project"("groupId");

-- CreateIndex
CREATE INDEX "ProjectIssueType_issueTypeId_idx" ON "ProjectIssueType"("issueTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "ProjectMember_groupId_idx" ON "ProjectMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "WorkItemComment_workItemId_idx" ON "WorkItemComment"("workItemId");

-- CreateIndex
CREATE INDEX "WorkItemHistory_workItemId_idx" ON "WorkItemHistory"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemFieldValue_workItemId_fieldId_key" ON "WorkItemFieldValue"("workItemId", "fieldId");

-- CreateIndex
CREATE INDEX "LegacyFieldValue_entityKind_objectId_idx" ON "LegacyFieldValue"("entityKind", "objectId");

-- CreateIndex
CREATE INDEX "LegacyFieldValue_fieldId_value_idx" ON "LegacyFieldValue"("fieldId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyFieldValue_entityKind_objectId_fieldId_key" ON "LegacyFieldValue"("entityKind", "objectId", "fieldId");

-- CreateIndex
CREATE INDEX "EntityRecordFieldValue_fieldId_value_idx" ON "EntityRecordFieldValue"("fieldId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRecordFieldValue_entityRecordId_fieldId_key" ON "EntityRecordFieldValue"("entityRecordId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectDef_key_key" ON "ObjectDef"("key");

-- CreateIndex
CREATE INDEX "ObjectDef_fieldSchemaId_idx" ON "ObjectDef"("fieldSchemaId");

-- CreateIndex
CREATE INDEX "ObjectDef_deletedAt_idx" ON "ObjectDef"("deletedAt");

-- CreateIndex
CREATE INDEX "ObjectRecord_objectDefId_sortOrder_idx" ON "ObjectRecord"("objectDefId", "sortOrder");

-- CreateIndex
CREATE INDEX "ObjectRecord_parentId_idx" ON "ObjectRecord"("parentId");

-- CreateIndex
CREATE INDEX "ObjectRecord_deletedAt_idx" ON "ObjectRecord"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectRecord_objectDefId_key_key" ON "ObjectRecord"("objectDefId", "key");

-- CreateIndex
CREATE INDEX "ObjectRecordFieldValue_fieldId_value_idx" ON "ObjectRecordFieldValue"("fieldId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectRecordFieldValue_objectRecordId_fieldId_key" ON "ObjectRecordFieldValue"("objectRecordId", "fieldId");

-- CreateIndex
CREATE INDEX "WorkItemWatcher_userId_idx" ON "WorkItemWatcher"("userId");

-- CreateIndex
CREATE INDEX "WorkItemWatcher_workItemId_idx" ON "WorkItemWatcher"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemWatcher_workItemId_userId_key" ON "WorkItemWatcher"("workItemId", "userId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workItemId_idx" ON "Notification"("workItemId");

-- CreateIndex
CREATE INDEX "Notification_checklistRunId_idx" ON "Notification"("checklistRunId");

-- CreateIndex
CREATE INDEX "Notification_cycleId_idx" ON "Notification"("cycleId");

-- CreateIndex
CREATE INDEX "Cycle_issueTypeId_idx" ON "Cycle"("issueTypeId");

-- CreateIndex
CREATE INDEX "Cycle_projectId_idx" ON "Cycle"("projectId");

-- CreateIndex
CREATE INDEX "Cycle_groupId_idx" ON "Cycle"("groupId");

-- CreateIndex
CREATE INDEX "Cycle_scope_idx" ON "Cycle"("scope");

-- CreateIndex
CREATE INDEX "Cycle_statusId_idx" ON "Cycle"("statusId");

-- CreateIndex
CREATE INDEX "Cycle_ownerId_idx" ON "Cycle"("ownerId");

-- CreateIndex
CREATE INDEX "Cycle_deletedAt_idx" ON "Cycle"("deletedAt");

-- CreateIndex
CREATE INDEX "CycleProjectInheritance_projectId_idx" ON "CycleProjectInheritance"("projectId");

-- CreateIndex
CREATE INDEX "CycleComment_cycleId_idx" ON "CycleComment"("cycleId");

-- CreateIndex
CREATE INDEX "CycleHistory_cycleId_idx" ON "CycleHistory"("cycleId");

-- CreateIndex
CREATE INDEX "CycleWatcher_userId_idx" ON "CycleWatcher"("userId");

-- CreateIndex
CREATE INDEX "CycleWatcher_cycleId_idx" ON "CycleWatcher"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleWatcher_cycleId_userId_key" ON "CycleWatcher"("cycleId", "userId");

-- CreateIndex
CREATE INDEX "CycleRecordMeta_scope_idx" ON "CycleRecordMeta"("scope");

-- CreateIndex
CREATE INDEX "CycleRecordMeta_groupId_idx" ON "CycleRecordMeta"("groupId");

-- CreateIndex
CREATE INDEX "CycleRecordMeta_projectId_idx" ON "CycleRecordMeta"("projectId");

-- CreateIndex
CREATE INDEX "CycleRecordMeta_ownerId_idx" ON "CycleRecordMeta"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGroup_slug_key" ON "ProjectGroup"("slug");

-- CreateIndex
CREATE INDEX "ProjectGroup_ownerId_idx" ON "ProjectGroup"("ownerId");

-- CreateIndex
CREATE INDEX "ProjectGroupMember_userId_idx" ON "ProjectGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGroupMember_groupId_userId_key" ON "ProjectGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "UserProjectPreference_userId_idx" ON "UserProjectPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProjectPreference_userId_projectId_key" ON "UserProjectPreference"("userId", "projectId");

-- CreateIndex
CREATE INDEX "Checklist_projectId_archivedAt_idx" ON "Checklist"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "Checklist_projectId_sortOrder_idx" ON "Checklist"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "Checklist_createdById_idx" ON "Checklist"("createdById");

-- CreateIndex
CREATE INDEX "ChecklistItemGroup_checklistId_sortOrder_idx" ON "ChecklistItemGroup"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_sortOrder_idx" ON "ChecklistItem"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_groupId_sortOrder_idx" ON "ChecklistItem"("checklistId", "groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistRun_checklistId_status_idx" ON "ChecklistRun"("checklistId", "status");

-- CreateIndex
CREATE INDEX "ChecklistRun_checklistId_startedAt_idx" ON "ChecklistRun"("checklistId", "startedAt");

-- CreateIndex
CREATE INDEX "ChecklistRun_completedAt_idx" ON "ChecklistRun"("completedAt");

-- CreateIndex
CREATE INDEX "ChecklistRunItem_runId_sortOrder_idx" ON "ChecklistRunItem"("runId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistRunItem_runId_groupSortOrder_sortOrder_idx" ON "ChecklistRunItem"("runId", "groupSortOrder", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistRunItem_sourceItemId_idx" ON "ChecklistRunItem"("sourceItemId");

-- CreateIndex
CREATE INDEX "ChecklistRunEvent_runId_createdAt_idx" ON "ChecklistRunEvent"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivity_projectId_createdAt_idx" ON "ProjectActivity"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivity_projectId_kind_createdAt_idx" ON "ProjectActivity"("projectId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivity_actorId_idx" ON "ProjectActivity"("actorId");

-- CreateIndex
CREATE INDEX "ProjectGroupActivity_projectGroupId_createdAt_idx" ON "ProjectGroupActivity"("projectGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectGroupActivity_projectGroupId_kind_createdAt_idx" ON "ProjectGroupActivity"("projectGroupId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectGroupActivity_actorId_idx" ON "ProjectGroupActivity"("actorId");
