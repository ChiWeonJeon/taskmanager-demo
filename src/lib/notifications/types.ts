export const NOTIFICATION_TYPES = [
  "mention",
  "cross_reference",
  "work_item_updated",
  "work_item_commented",
  "work_item_assigned",
  "checklist_run_started",
  "checklist_run_completed",
  "checklist_run_canceled",
  "cycle_commented",
  "cycle_updated",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_SCOPES = ["work_item", "checklist", "cycle"] as const;
export type NotificationScope = (typeof NOTIFICATION_SCOPES)[number];

export const WATCHER_SOURCES = [
  "manual",
  "auto_creator",
  "auto_editor",
  "auto_commenter",
  "auto_assignee",
  "auto_mention",
  "added_by_other",
] as const;
export type WatcherSource = (typeof WATCHER_SOURCES)[number];

export interface MentionPayload {
  // mention only
  context?: "description" | "comment" | "cycle_comment";
  issueKey?: string;
  workItemTitle?: string;
  projectKey?: string;
  cycleName?: string;
}

export interface ChecklistRunPayload {
  checklistId: string;
  checklistTitle: string;
  projectKey?: string;
  // For COMPLETED only: progress snapshot at completion time.
  totalItems?: number;
  checkedItems?: number;
}

export interface WorkItemUpdatedPayload {
  fieldKeys: string[];
  issueKey?: string;
  workItemTitle?: string;
}

export interface WorkItemCommentedPayload {
  commentId: string;
  issueKey?: string;
  workItemTitle?: string;
}

export interface WorkItemAssignedPayload {
  issueKey?: string;
  workItemTitle?: string;
}

export interface CycleCommentedPayload {
  cycleName: string;
  projectKey?: string;
  groupSlug?: string;
  context?: "comment";
}

export interface CycleUpdatedPayload {
  cycleName: string;
  fieldKeys: string[];
  projectKey?: string;
  groupSlug?: string;
}

// Cross-reference notification — fired when a user writes a `#TASK-42` mention
// (not an @user mention). The notification's workItemId/commentId point at the
// source where the mention was written.
export interface CrossReferencePayload {
  sourceContext: "description" | "comment";
  sourceIssueKey?: string;
  sourceWorkItemTitle?: string;
  sourceProjectKey?: string;
  // Target display.
  targetType: "work_item";
  targetIssueKey?: string;
  targetWorkItemTitle?: string;
}

export type NotificationPayload =
  | MentionPayload
  | CrossReferencePayload
  | WorkItemUpdatedPayload
  | WorkItemCommentedPayload
  | WorkItemAssignedPayload
  | ChecklistRunPayload
  | CycleCommentedPayload
  | CycleUpdatedPayload;
