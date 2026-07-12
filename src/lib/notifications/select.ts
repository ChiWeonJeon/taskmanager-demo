export const notificationListSelect = {
  id: true,
  type: true,
  scope: true,
  actorId: true,
  workItemId: true,
  projectId: true,
  checklistRunId: true,
  cycleId: true,
  commentId: true,
  payloadJson: true,
  isRead: true,
  createdAt: true,
  readAt: true,
  actor: { select: { id: true, name: true, shortName: true, email: true, avatarUpdatedAt: true } },
  workItem: { select: { id: true, issueKey: true, title: true, projectId: true, deletedAt: true } },
  project: { select: { id: true, key: true, name: true } },
  checklistRun: {
    select: {
      id: true,
      checklistId: true,
      checklist: {
        select: {
          id: true,
          project: { select: { id: true, key: true } },
        },
      },
    },
  },
  cycle: { select: { id: true, name: true, projectId: true, groupId: true, deletedAt: true } },
} as const;
