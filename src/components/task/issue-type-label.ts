import type { IssueTypeOption, WorkItemWithRelations } from "@/components/task/types";
import type { LocaleMessages } from "@/lib/i18n/messages";

type IssueTypeLike = Pick<IssueTypeOption, "key" | "name" | "category"> | WorkItemWithRelations["issueType"];

export function getIssueTypeScopeLabel(messages: LocaleMessages, issueType: IssueTypeLike) {
  switch (issueType.category) {
    case "ISSUE":
      return messages.entityTypeScopes.issue;
    case "CYCLE":
      return messages.entityTypeScopes.cycle;
  }

  switch (issueType.key) {
    case "task":
    case "bug":
    case "story":
      return messages.entityTypeScopes.issue;
    case "cycle":
      return messages.entityTypeScopes.cycle;
    default:
      return messages.entityTypeScopes.issue;
  }
}
