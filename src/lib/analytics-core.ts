export const ANALYTICS_EVENTS = [
  "Page Viewed",
  "Demo Entered",
  "Task Opened",
  "Task View Mode Changed",
  "Today Bucket Selected",
  "Saved View Applied",
  "Task Filter Applied",
  "Task Sort Changed",
  "Task Group Changed",
  "Cycle Opened",
  "Activity Filter Changed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsWorkspaceScope = "personal" | "global" | "project" | "group" | "other";
export type AnalyticsViewMode = "list" | "grid" | "kanban" | "gantt" | "calendar" | "deep_link";

const COMMON_PROPERTY_KEYS = ["route_template", "workspace_scope"] as const;

export const ANALYTICS_EVENT_PROPERTY_KEYS: Record<AnalyticsEventName, readonly string[]> = {
  "Page Viewed": ["page_name", "route_template", "referrer_host", "workspace_scope"],
  "Demo Entered": ["entry_method", ...COMMON_PROPERTY_KEYS],
  "Task Opened": ["issue_type", "project_key", "source_view", ...COMMON_PROPERTY_KEYS],
  "Task View Mode Changed": ["from_mode", "to_mode", ...COMMON_PROPERTY_KEYS],
  "Today Bucket Selected": ["bucket", "my_tasks_only", ...COMMON_PROPERTY_KEYS],
  "Saved View Applied": ["view_name", "target_mode", ...COMMON_PROPERTY_KEYS],
  "Task Filter Applied": ["field_key", "operator", "condition_count", ...COMMON_PROPERTY_KEYS],
  "Task Sort Changed": ["field_key", "direction", "rule_count", ...COMMON_PROPERTY_KEYS],
  "Task Group Changed": ["field_key", "cleared", ...COMMON_PROPERTY_KEYS],
  "Cycle Opened": ["cycle_name", "cycle_scope", "action", ...COMMON_PROPERTY_KEYS],
  "Activity Filter Changed": ["activity_kind", ...COMMON_PROPERTY_KEYS],
};

export interface AnalyticsEventProperties {
  "Page Viewed": {
    page_name: string;
    route_template: string;
    referrer_host: string;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Demo Entered": { entry_method: "one_click" };
  "Task Opened": {
    issue_type: string;
    project_key: string;
    source_view: AnalyticsViewMode;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Task View Mode Changed": {
    from_mode: Exclude<AnalyticsViewMode, "deep_link">;
    to_mode: Exclude<AnalyticsViewMode, "deep_link">;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Today Bucket Selected": {
    bucket: "byToday" | "overdue" | "next7" | "unplanned" | "done";
    workspace_scope: AnalyticsWorkspaceScope;
    my_tasks_only: boolean;
  };
  "Saved View Applied": {
    view_name: string;
    target_mode: Exclude<AnalyticsViewMode, "deep_link">;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Task Filter Applied": {
    field_key: string;
    operator: string;
    condition_count: number;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Task Sort Changed": {
    field_key: string;
    direction: string;
    rule_count: number;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Task Group Changed": {
    field_key: string;
    cleared: boolean;
    workspace_scope: AnalyticsWorkspaceScope;
  };
  "Cycle Opened": {
    cycle_name: string;
    cycle_scope: "project" | "group";
    action: "detail" | "view_tasks";
  };
  "Activity Filter Changed": {
    activity_kind: string;
    workspace_scope: AnalyticsWorkspaceScope;
  };
}

export interface AnalyticsRouteMetadata {
  pageName: string;
  routeTemplate: string;
  workspaceScope: AnalyticsWorkspaceScope;
}

export function isAnalyticsEnabled(enabledValue: string | undefined, tokenValue: string | undefined): boolean {
  return enabledValue === "true" && Boolean(tokenValue?.trim());
}

const STATIC_PAGE_NAMES: Record<string, string> = {
  "/": "Root",
  "/login": "Login",
  "/today": "My Today",
  "/tasks": "My Tasks",
  "/my-activity": "My Activity",
  "/all-today": "All Today",
  "/all-tasks": "All Tasks",
  "/all-cycles": "All Cycles",
  "/all-activity": "All Activity",
  "/projects": "Projects",
  "/groups": "Groups",
  "/profile": "Profile",
  "/notifications": "Notifications",
};

export function routeMetadata(pathname: string): AnalyticsRouteMetadata {
  const cleanPath = `/${pathname.split("?")[0]?.split("#")[0]?.split("/").filter(Boolean).join("/") ?? ""}`;
  const segments = cleanPath.split("/").filter(Boolean);
  let workspaceScope: AnalyticsWorkspaceScope = "other";
  const templateSegments = [...segments];

  if (segments[0] === "projects") {
    workspaceScope = segments.length > 1 ? "project" : "other";
    if (segments.length > 1) templateSegments[1] = ":project";
  } else if (segments[0] === "groups") {
    workspaceScope = segments.length > 1 ? "group" : "other";
    if (segments.length > 1) templateSegments[1] = ":group";
  } else if (["all-today", "all-tasks", "all-cycles", "all-activity", "globe"].includes(segments[0] ?? "")) {
    workspaceScope = "global";
  } else if (["today", "tasks", "my-activity", "home"].includes(segments[0] ?? "")) {
    workspaceScope = "personal";
  }

  const routeTemplate = templateSegments.length ? `/${templateSegments.join("/")}` : "/";
  const pageName = STATIC_PAGE_NAMES[cleanPath]
    ?? (segments[0] === "projects" && segments.length > 1
      ? `Project ${segments[2] ?? "Overview"}`
      : segments[0] === "groups" && segments.length > 1
        ? `Group ${segments[2] ?? "Overview"}`
        : segments.map((segment) => segment.replaceAll("-", " ")).join(" ") || "Root");

  return { pageName, routeTemplate, workspaceScope };
}

export function workspaceScopeFromKey(workspaceKey: string): AnalyticsWorkspaceScope {
  if (workspaceKey.startsWith("tasks:my")) return "personal";
  if (workspaceKey.startsWith("tasks:all")) return "global";
  if (workspaceKey.startsWith("tasks:project")) return "project";
  if (workspaceKey.startsWith("tasks:group")) return "group";
  return "other";
}

export function safeReferrerHost(referrer: string, currentHost: string): string {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).host;
    return host === currentHost ? "internal" : host.slice(0, 120);
  } catch {
    return "unknown";
  }
}

export function sanitizeAnalyticsProperties(
  properties: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") sanitized[key] = value.slice(0, 120);
    else if (typeof value === "number" && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === "boolean") sanitized[key] = value;
  }
  return sanitized;
}

export function sanitizeEventProperties(
  event: AnalyticsEventName,
  properties: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const allowed = new Set(ANALYTICS_EVENT_PROPERTY_KEYS[event]);
  return sanitizeAnalyticsProperties(Object.fromEntries(
    Object.entries(properties).filter(([key]) => allowed.has(key)),
  ));
}
