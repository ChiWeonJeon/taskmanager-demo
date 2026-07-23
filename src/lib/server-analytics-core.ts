export const SERVER_ANALYTICS_EVENTS = [
  "Authentication Succeeded",
  "Project Created",
  "Work Item Created",
  "Work Item Updated",
  "Checklist Run Completed",
] as const;

export type ServerAnalyticsEventName = (typeof SERVER_ANALYTICS_EVENTS)[number];
export type ServerAnalyticsWorkspaceScope = "personal" | "project" | "group";

export interface ServerAnalyticsEventProperties {
  "Authentication Succeeded": {
    auth_method: "credentials" | "oauth" | "sso";
  };
  "Project Created": {
    project_type: "personal" | "shared";
  };
  "Work Item Created": {
    workspace_scope: ServerAnalyticsWorkspaceScope;
    issue_type: string;
  };
  "Work Item Updated": {
    workspace_scope: ServerAnalyticsWorkspaceScope;
    changed_field_count: number;
  };
  "Checklist Run Completed": {
    workspace_scope: "project";
    checked_item_count: number;
    total_item_count: number;
  };
}

export const SERVER_ANALYTICS_EVENT_PROPERTY_KEYS: Record<ServerAnalyticsEventName, readonly string[]> = {
  "Authentication Succeeded": ["auth_method"],
  "Project Created": ["project_type"],
  "Work Item Created": ["workspace_scope", "issue_type"],
  "Work Item Updated": ["workspace_scope", "changed_field_count"],
  "Checklist Run Completed": ["workspace_scope", "checked_item_count", "total_item_count"],
};

export function isServerAnalyticsEnabled(settings: {
  nodeEnv?: string;
  vercelEnv?: string;
  enabled?: string;
  demoMode?: string;
  demoReadOnly?: string;
  identitySalt?: string;
}): boolean {
  const productionRuntime = settings.nodeEnv === "production"
    && (!settings.vercelEnv || settings.vercelEnv === "production");
  return productionRuntime
    && settings.enabled === "true"
    && settings.demoMode !== "true"
    && settings.demoReadOnly !== "true"
    && Boolean(settings.identitySalt?.trim());
}

export function sanitizeServerEventProperties(
  event: ServerAnalyticsEventName,
  properties: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const allowed = new Set(SERVER_ANALYTICS_EVENT_PROPERTY_KEYS[event]);
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key) || value === null || value === undefined) continue;
    if (typeof value === "string") sanitized[key] = value.slice(0, 120);
    else if (typeof value === "number" && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === "boolean") sanitized[key] = value;
  }

  return sanitized;
}

export function isRetryableDeliveryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function nextDeliveryDelayMs(attempt: number): number {
  return Math.min(60 * 60 * 1000, 2 ** Math.max(0, attempt - 1) * 2_000);
}

export function serverWorkspaceScope(project: { isPersonal: boolean; groupId?: string | null }): ServerAnalyticsWorkspaceScope {
  if (project.isPersonal) return "personal";
  return project.groupId ? "group" : "project";
}
