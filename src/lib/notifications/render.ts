import type { LocaleMessages } from "@/lib/i18n/messages";
import type { NotificationType } from "./types";

export interface NotificationRecord {
  id: string;
  type: string;
  scope: string;
  payloadJson: string;
  actor: { id: string; name: string; email: string } | null;
  workItem: { id: string; issueKey: string; title: string; projectId: string | null; deletedAt: Date | string | null } | null;
  project: { id: string; key: string; name: string } | null;
  checklistRun: {
    id: string;
    checklistId: string;
    checklist: { id: string; project: { id: string; key: string } | null } | null;
  } | null;
  cycle: { id: string; name: string; projectId: string | null; groupId: string | null; deletedAt: Date | string | null } | null;
}

interface RenderResult {
  text: string;
  href: string | null;
  isOrphan: boolean;
}

function safeParse(json: string): Record<string, unknown> {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => vars[key] ?? "");
}

function joinFields(keys: string[], messages: LocaleMessages): string {
  const fieldNames = messages.notifications.fieldNames as Record<string, string>;
  return keys.map((k) => fieldNames[k] ?? k).join(", ");
}

export function renderNotification(
  notification: NotificationRecord,
  messages: LocaleMessages
): RenderResult {
  const payload = safeParse(notification.payloadJson);
  const actorName = notification.actor?.name ?? messages.notifications.deletedItem ?? "?";
  const t = messages.notifications.templates as Record<string, string>;
  const type = notification.type as NotificationType;
  const empty = messages.notifications.deletedItem ?? "";

  const wiOrphan = notification.workItem ? Boolean(notification.workItem.deletedAt) : false;

  const issueKey = (payload.issueKey as string) ?? notification.workItem?.issueKey ?? "";
  const wiTitle = (payload.workItemTitle as string) ?? notification.workItem?.title ?? empty;
  const projectKey = (payload.projectKey as string) ?? notification.project?.key ?? "";

  let text = "";
  let href: string | null = null;
  let isOrphan = false;

  if (notification.scope === "cycle") {
    const cycleName = (payload.cycleName as string) ?? notification.cycle?.name ?? empty;
    isOrphan = !notification.cycle || Boolean(notification.cycle.deletedAt);
    if (type === "cycle_updated") {
      const fieldKeys = Array.isArray(payload.fieldKeys) ? (payload.fieldKeys as string[]) : [];
      text = applyTemplate(t.cycle_updated, {
        actor: actorName,
        cycleName,
        fields: joinFields(fieldKeys, messages),
      });
    } else if (type === "mention") {
      text = applyTemplate(t.cycle_mention, { actor: actorName, cycleName });
    } else {
      text = applyTemplate(t.cycle_commented, { actor: actorName, cycleName });
    }
    href = isOrphan ? null : `/all-cycles?cycle=${notification.cycle!.id}`;
    return { text, href, isOrphan };
  }

  if (notification.scope === "checklist") {
    const checklistTitle = (payload.checklistTitle as string) ?? empty;
    const totalItems = payload.totalItems != null ? String(payload.totalItems) : "";
    const checkedItems = payload.checkedItems != null ? String(payload.checkedItems) : "";
    const tmpl =
      type === "checklist_run_completed"
        ? t.checklist_run_completed
        : type === "checklist_run_canceled"
          ? t.checklist_run_canceled
          : t.checklist_run_started;
    text = applyTemplate(tmpl, {
      actor: actorName,
      checklistTitle,
      total: totalItems,
      checked: checkedItems,
    });
    isOrphan = !notification.checklistRun || !notification.checklistRun.checklist;
    if (!isOrphan) {
      const cr = notification.checklistRun!;
      const projectKeyForRun = cr.checklist?.project?.key ?? projectKey;
      if (projectKeyForRun) {
        href = `/projects/${projectKeyForRun}/checklists/${cr.checklistId}/runs/${cr.id}`;
      }
    }
    return { text, href, isOrphan };
  }

  // work_item scope
  isOrphan = wiOrphan || !notification.workItem;
  if (!isOrphan && notification.workItem?.id) {
    href = `/tasks?task=${notification.workItem.id}`;
  }

  switch (type) {
    case "mention": {
      const ctx = (payload.context as string) ?? "description";
      const tmpl = ctx === "comment" ? t.mention_work_item_comment : t.mention_work_item;
      text = applyTemplate(tmpl, { actor: actorName, issueKey, title: wiTitle });
      break;
    }
    case "cross_reference": {
      text = renderCrossReference(payload, actorName, t, empty);
      break;
    }
    case "work_item_updated": {
      const fieldKeys = Array.isArray(payload.fieldKeys)
        ? (payload.fieldKeys as string[])
        : [];
      if (fieldKeys.length === 1) {
        text = applyTemplate(t.work_item_updated_single, {
          actor: actorName,
          issueKey,
          title: wiTitle,
          field: joinFields(fieldKeys, messages),
        });
      } else {
        text = applyTemplate(t.work_item_updated, {
          actor: actorName,
          issueKey,
          title: wiTitle,
          fields: joinFields(fieldKeys, messages),
        });
      }
      break;
    }
    case "work_item_commented":
      text = applyTemplate(t.work_item_commented, { actor: actorName, issueKey, title: wiTitle });
      break;
    case "work_item_assigned":
      text = applyTemplate(t.work_item_assigned, { actor: actorName, issueKey, title: wiTitle });
      break;
    default:
      text = `${actorName} · ${wiTitle}`;
  }

  return { text, href: isOrphan ? null : href, isOrphan };
}

function renderCrossReference(
  payload: Record<string, unknown>,
  actorName: string,
  t: Record<string, string>,
  empty: string
): string {
  const targetType = (payload.targetType as string) ?? "work_item";
  const targetIssueKey = (payload.targetIssueKey as string) ?? "";
  const targetWorkItemTitle = (payload.targetWorkItemTitle as string) ?? empty;
  const sourceContext = (payload.sourceContext as string) ?? "";
  const sourceIssueKey = (payload.sourceIssueKey as string) ?? "";
  const sourceWorkItemTitle = (payload.sourceWorkItemTitle as string) ?? "";

  const target = targetType === "work_item"
    ? `${targetIssueKey} ${targetWorkItemTitle}`.trim()
    : empty;

  const source = `${sourceIssueKey} ${sourceWorkItemTitle}`.trim() || empty;

  const tmpl = t.cross_reference ?? "{actor} referenced {target} in {source} ({context})";
  return applyTemplate(tmpl, { actor: actorName, target, source, context: sourceContext });
}
