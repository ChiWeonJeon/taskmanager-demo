import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ANALYTICS_EVENTS,
  anonymousBrowserProfileName,
  isAnalyticsEnabled,
  routeMetadata,
  safeReferrerHost,
  sanitizeAnalyticsProperties,
  sanitizeEventProperties,
  workspaceScopeFromKey,
} from "./analytics-core";

test("analytics has exactly the eleven approved explicit events", () => {
  assert.equal(ANALYTICS_EVENTS.length, 11);
  assert.deepEqual(ANALYTICS_EVENTS, [
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
  ]);
});

test("analytics is a no-op unless both production browser settings are present", () => {
  assert.equal(isAnalyticsEnabled(undefined, undefined), false);
  assert.equal(isAnalyticsEnabled("false", "token"), false);
  assert.equal(isAnalyticsEnabled("true", ""), false);
  assert.equal(isAnalyticsEnabled("true", "token"), true);
});

test("anonymous browser profiles use only the persisted Mixpanel device id", () => {
  assert.equal(anonymousBrowserProfileName("$device:5038fc3e-fa3a-4ffa-9cb7-35574249624c"), "Demo Browser 49624C");
  assert.equal(anonymousBrowserProfileName("shared-demo-viewer"), null);
  assert.equal(anonymousBrowserProfileName("$device:"), null);
});

test("analytics sends only the approved properties for each event", () => {
  assert.deepEqual(sanitizeEventProperties("Task Opened", {
    issue_type: "Bug",
    project_key: "CORE",
    source_view: "kanban",
    route_template: "/projects/:project/tasks",
    workspace_scope: "project",
    title: "must not leave the browser",
    user_id: "viewer",
    email: "viewer@example.com",
    current_url: "https://example.com/?private=yes",
  }), {
    issue_type: "Bug",
    project_key: "CORE",
    source_view: "kanban",
    route_template: "/projects/:project/tasks",
    workspace_scope: "project",
  });
});

test("analytics normalizes dynamic routes without query values", () => {
  assert.deepEqual(routeMetadata("/projects/GAME/tasks?task=secret"), {
    pageName: "Project tasks",
    routeTemplate: "/projects/:project/tasks",
    workspaceScope: "project",
  });
  assert.deepEqual(routeMetadata("/groups/game-production/activity"), {
    pageName: "Group activity",
    routeTemplate: "/groups/:group/activity",
    workspaceScope: "group",
  });
  assert.equal(routeMetadata("/all-tasks").workspaceScope, "global");
});

test("analytics derives safe scopes and referrer hosts", () => {
  assert.equal(workspaceScopeFromKey("tasks:my:today"), "personal");
  assert.equal(workspaceScopeFromKey("tasks:project:demo-project-game"), "project");
  assert.equal(safeReferrerHost("", "taskmanager-demo-five.vercel.app"), "direct");
  assert.equal(safeReferrerHost("https://taskmanager-demo-five.vercel.app/login?token=hidden", "taskmanager-demo-five.vercel.app"), "internal");
  assert.equal(safeReferrerHost("https://example.com/a?private=yes", "taskmanager-demo-five.vercel.app"), "example.com");
});

test("analytics properties keep primitives, truncate text, and drop empty values", () => {
  assert.deepEqual(sanitizeAnalyticsProperties({
    safe: "x".repeat(200),
    count: 2,
    enabled: true,
    missing: null,
    invalid: Number.NaN,
  }), {
    safe: "x".repeat(120),
    count: 2,
    enabled: true,
  });
});

test("browser analytics implementation stays explicit, browser-scoped, and disabled by default", async () => {
  const source = await readFile(new URL("./analytics.ts", import.meta.url), "utf8");
  assert.match(source, /NEXT_PUBLIC_MIXPANEL_ENABLED/);
  assert.match(source, /autocapture: false/);
  assert.match(source, /track_pageview: false/);
  assert.match(source, /record_sessions_percent: 0/);
  assert.match(source, /ip: false/);
  assert.match(source, /window\.location\.origin}\/mp/);
  assert.match(source, /mixpanel\.identify\(distinctId\)/);
  assert.match(source, /mixpanel\.people\.set\(/);
  assert.match(source, /profile_type: "anonymous_demo_browser"/);
  assert.match(source, /identity_scope: "browser_local_storage"/);
  assert.match(source, /opt_out_tracking\(\{ delete_user: true \}\)/);
  assert.doesNotMatch(source, /identify\([^)]*(viewer|user|email)/i);
  assert.doesNotMatch(source, /\.alias\s*\(/);
  assert.doesNotMatch(source, /\.reset\s*\(/);
  assert.doesNotMatch(source, /\$email|\bemail\s*:|user_id|viewer_id/i);
});

test("production analytics uses a public same-origin rewrite to Mixpanel US ingestion", async () => {
  const vercelConfig = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(vercelConfig.rewrites, [{
    source: "/mp/:path*",
    destination: "https://api.mixpanel.com/:path*",
  }]);

  const authSource = await readFile(new URL("./auth.config.ts", import.meta.url), "utf8");
  assert.match(authSource, /pathname\.startsWith\("\/mp\/"\)/);
});
