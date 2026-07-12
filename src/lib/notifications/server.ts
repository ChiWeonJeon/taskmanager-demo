import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { MentionRef } from "@/lib/mention/extract";
import { addCycleWatcherIfMissing, getCycleWatcherIds } from "@/lib/cycle/watchers";
import { scopedWorkItemWhere } from "@/lib/work-item-query";
import type {
  ChecklistRunPayload,
  CrossReferencePayload,
  CycleCommentedPayload,
  CycleUpdatedPayload,
  MentionPayload,
  NotificationScope,
  NotificationType,
  WatcherSource,
  WorkItemAssignedPayload,
  WorkItemCommentedPayload,
  WorkItemUpdatedPayload,
} from "./types";

type Tx = typeof prisma | Prisma.TransactionClient;

export async function addWatcherIfMissing(
  tx: Tx,
  args: { workItemId: string; userId: string; source: WatcherSource; addedById?: string | null }
): Promise<void> {
  if (!args.userId) return;
  await tx.workItemWatcher.upsert({
    where: { workItemId_userId: { workItemId: args.workItemId, userId: args.userId } },
    update: {},
    create: {
      workItemId: args.workItemId,
      userId: args.userId,
      source: args.source,
      addedById: args.addedById ?? null,
    },
  });
}

export async function getWatcherIds(tx: Tx, workItemId: string): Promise<string[]> {
  const rows = await tx.workItemWatcher.findMany({
    where: { workItemId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

interface CreateOpts {
  scope: NotificationScope;
  type: NotificationType;
  recipientIds: string[];
  actorId: string | null;
  workItemId?: string | null;
  projectId?: string | null;
  checklistRunId?: string | null;
  cycleId?: string | null;
  commentId?: string | null;
  payload: object;
}

async function createBatch(tx: Tx, opts: CreateOpts): Promise<string[]> {
  const filtered = Array.from(new Set(opts.recipientIds)).filter(
    (id) => id && id !== opts.actorId
  );
  if (filtered.length === 0) return [];

  const payloadJson = JSON.stringify(opts.payload);
  await tx.notification.createMany({
    data: filtered.map((recipientId) => ({
      recipientId,
      type: opts.type,
      scope: opts.scope,
      actorId: opts.actorId,
      workItemId: opts.workItemId ?? null,
      projectId: opts.projectId ?? null,
      checklistRunId: opts.checklistRunId ?? null,
      cycleId: opts.cycleId ?? null,
      commentId: opts.commentId ?? null,
      payloadJson,
    })),
  });
  return filtered;
}

export async function notifyChecklistRunEvent(
  tx: Tx,
  args: {
    type: "checklist_run_started" | "checklist_run_completed" | "checklist_run_canceled";
    runId: string;
    actorId: string;
    recipientIds: string[];
    projectId: string;
    payload: ChecklistRunPayload;
  }
): Promise<string[]> {
  return createBatch(tx, {
    scope: "checklist",
    type: args.type,
    recipientIds: args.recipientIds,
    actorId: args.actorId,
    projectId: args.projectId,
    checklistRunId: args.runId,
    payload: args.payload,
  });
}

export async function notifyCycleUpdated(
  tx: Tx,
  args: {
    cycleId: string;
    actorId: string | null;
    fieldKeys: string[];
    recipientIds?: string[];
    projectId?: string | null;
    payload: CycleUpdatedPayload;
  }
): Promise<string[]> {
  if (args.fieldKeys.length === 0) return [];
  const watcherIds = args.recipientIds ?? await getCycleWatcherIds(tx, args.cycleId);
  return createBatch(tx, {
    scope: "cycle",
    type: "cycle_updated",
    recipientIds: watcherIds,
    actorId: args.actorId,
    cycleId: args.cycleId,
    projectId: args.projectId ?? null,
    payload: args.payload,
  });
}

export async function notifyCycleCommented(
  tx: Tx,
  args: {
    cycleId: string;
    commentId: string;
    actorId: string | null;
    recipientIds?: string[];
    skipRecipientIds?: string[];
    projectId?: string | null;
    payload: CycleCommentedPayload;
  }
): Promise<string[]> {
  const watcherIds = args.recipientIds ?? await getCycleWatcherIds(tx, args.cycleId);
  const skip = new Set(args.skipRecipientIds ?? []);
  return createBatch(tx, {
    scope: "cycle",
    type: "cycle_commented",
    recipientIds: watcherIds.filter((id) => !skip.has(id)),
    actorId: args.actorId,
    cycleId: args.cycleId,
    projectId: args.projectId ?? null,
    commentId: args.commentId,
    payload: args.payload,
  });
}

export async function notifyWorkItemUpdated(
  tx: Tx,
  args: {
    workItemId: string;
    actorId: string | null;
    fieldKeys: string[];
    newAssigneeId?: string | null;
    skipRecipientIds?: string[];
    issueKey?: string;
    workItemTitle?: string;
    projectId?: string | null;
  }
): Promise<void> {
  if (args.fieldKeys.length === 0 && !args.newAssigneeId) return;

  const watcherIds = await getWatcherIds(tx, args.workItemId);
  const skip = new Set(args.skipRecipientIds ?? []);

  if (args.newAssigneeId && !skip.has(args.newAssigneeId)) {
    const payload: WorkItemAssignedPayload = {
      issueKey: args.issueKey,
      workItemTitle: args.workItemTitle,
    };
    await createBatch(tx, {
      scope: "work_item",
      type: "work_item_assigned",
      recipientIds: [args.newAssigneeId],
      actorId: args.actorId,
      workItemId: args.workItemId,
      projectId: args.projectId,
      payload,
    });
    skip.add(args.newAssigneeId);
  }

  if (args.fieldKeys.length === 0) return;

  const updatedRecipients = watcherIds.filter((id) => !skip.has(id));
  if (updatedRecipients.length === 0) return;

  const payload: WorkItemUpdatedPayload = {
    fieldKeys: args.fieldKeys,
    issueKey: args.issueKey,
    workItemTitle: args.workItemTitle,
  };
  await createBatch(tx, {
    scope: "work_item",
    type: "work_item_updated",
    recipientIds: updatedRecipients,
    actorId: args.actorId,
    workItemId: args.workItemId,
    projectId: args.projectId,
    payload,
  });
}

export async function notifyWorkItemCommented(
  tx: Tx,
  args: {
    workItemId: string;
    commentId: string;
    actorId: string | null;
    skipRecipientIds?: string[];
    issueKey?: string;
    workItemTitle?: string;
    projectId?: string | null;
  }
): Promise<void> {
  const watcherIds = await getWatcherIds(tx, args.workItemId);
  const skip = new Set(args.skipRecipientIds ?? []);
  const recipients = watcherIds.filter((id) => !skip.has(id));
  if (recipients.length === 0) return;

  const payload: WorkItemCommentedPayload = {
    commentId: args.commentId,
    issueKey: args.issueKey,
    workItemTitle: args.workItemTitle,
  };
  await createBatch(tx, {
    scope: "work_item",
    type: "work_item_commented",
    recipientIds: recipients,
    actorId: args.actorId,
    workItemId: args.workItemId,
    projectId: args.projectId,
    commentId: args.commentId,
    payload,
  });
}

export async function notifyMention(
  tx: Tx,
  args: {
    scope: NotificationScope;
    actorId: string;
    recipientIds: string[];
    workItemId?: string;
    cycleId?: string;
    commentId?: string;
    projectId?: string | null;
    payload: MentionPayload;
  }
): Promise<string[]> {
  const created = await createBatch(tx, {
    scope: args.scope,
    type: "mention",
    recipientIds: args.recipientIds,
    actorId: args.actorId,
    workItemId: args.workItemId ?? null,
    projectId: args.projectId,
    cycleId: args.cycleId ?? null,
    commentId: args.commentId ?? null,
    payload: args.payload,
  });

  // Auto-watch on work-item mention
  if (args.scope === "work_item" && args.workItemId) {
    for (const recipientId of created) {
      await addWatcherIfMissing(tx, {
        workItemId: args.workItemId,
        userId: recipientId,
        source: "auto_mention",
        addedById: args.actorId,
      });
    }
  }
  if (args.scope === "cycle" && args.cycleId) {
    for (const recipientId of created) {
      await addCycleWatcherIfMissing(tx, {
        cycleId: args.cycleId,
        userId: recipientId,
        source: "auto_mention",
        addedById: args.actorId,
      });
    }
  }
  return created;
}

// Fire cross-reference notifications for issue (`#TASK-42`) mentions.
// Recipient set is derived from target work item watchers.
// Source context is recorded so the notification points back to where the
// mention was authored.
export async function notifyCrossReferences(
  tx: Tx,
  args: {
    actorId: string;
    refs: MentionRef[];
    source: {
      scope: NotificationScope;
      projectId: string | null;
      workItemId?: string;
      commentId?: string;
      sourceContext: CrossReferencePayload["sourceContext"];
      sourceIssueKey?: string;
      sourceWorkItemTitle?: string;
      sourceProjectKey?: string;
    };
    skipRecipientIds?: string[];
  }
): Promise<string[]> {
  const issueIds = args.refs.filter((r) => r.type === "issue").map((r) => r.id);
  if (issueIds.length === 0) return [];

  const skip = new Set([args.actorId, ...(args.skipRecipientIds ?? [])]);
  const created: string[] = [];

  if (issueIds.length > 0) {
    const workItems = await tx.workItem.findMany({
      where: scopedWorkItemWhere({ id: { in: issueIds }, deletedAt: null }),
      select: { id: true, issueKey: true, title: true },
    });
    for (const target of workItems) {
      // Do not notify a cross-reference to the source itself
      // (e.g., `#SELF` written inside SELF's own description).
      if (args.source.workItemId === target.id) continue;
      const watcherIds = await getWatcherIds(tx, target.id);
      const recipients = watcherIds.filter((id) => !skip.has(id));
      if (recipients.length === 0) continue;
      const payload: CrossReferencePayload = {
        sourceContext: args.source.sourceContext,
        sourceIssueKey: args.source.sourceIssueKey,
        sourceWorkItemTitle: args.source.sourceWorkItemTitle,
        sourceProjectKey: args.source.sourceProjectKey,
        targetType: "work_item",
        targetIssueKey: target.issueKey,
        targetWorkItemTitle: target.title,
      };
      const batchCreated = await createBatch(tx, {
        scope: args.source.scope,
        type: "cross_reference",
        recipientIds: recipients,
        actorId: args.actorId,
        workItemId: args.source.workItemId ?? null,
        commentId: args.source.commentId ?? null,
        projectId: args.source.projectId,
        payload,
      });
      created.push(...batchCreated);
    }
  }

  return Array.from(new Set(created));
}
