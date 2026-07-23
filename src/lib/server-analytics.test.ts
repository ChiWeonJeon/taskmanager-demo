import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SERVER_ANALYTICS_EVENTS,
  isRetryableDeliveryStatus,
  isServerAnalyticsEnabled,
  nextDeliveryDelayMs,
  sanitizeServerEventProperties,
  serverWorkspaceScope,
} from "./server-analytics-core";

test("server analytics has a separate explicit business-event catalog", () => {
  assert.deepEqual(SERVER_ANALYTICS_EVENTS, [
    "Authentication Succeeded",
    "Project Created",
    "Work Item Created",
    "Work Item Updated",
    "Checklist Run Completed",
  ]);
});

test("server analytics is production-only and disabled for the public demo", () => {
  const base = {
    nodeEnv: "production",
    vercelEnv: "production",
    enabled: "true",
    demoMode: "false",
    demoReadOnly: "false",
    identitySalt: "test-salt",
  };
  assert.equal(isServerAnalyticsEnabled(base), true);
  assert.equal(isServerAnalyticsEnabled({ ...base, nodeEnv: "development" }), false);
  assert.equal(isServerAnalyticsEnabled({ ...base, vercelEnv: "preview" }), false);
  assert.equal(isServerAnalyticsEnabled({ ...base, enabled: "false" }), false);
  assert.equal(isServerAnalyticsEnabled({ ...base, demoMode: "true" }), false);
  assert.equal(isServerAnalyticsEnabled({ ...base, demoReadOnly: "true" }), false);
  assert.equal(isServerAnalyticsEnabled({ ...base, identitySalt: "" }), false);
});

test("server analytics strips unapproved properties and content", () => {
  assert.deepEqual(sanitizeServerEventProperties("Work Item Created", {
    workspace_scope: "project",
    issue_type: "Task",
    title: "must not be stored",
    email: "person@example.com",
    current_url: "https://example.com/private",
  }), {
    workspace_scope: "project",
    issue_type: "Task",
  });
});

test("server analytics derives bounded workspace scopes", () => {
  assert.equal(serverWorkspaceScope({ isPersonal: true, groupId: null }), "personal");
  assert.equal(serverWorkspaceScope({ isPersonal: false, groupId: "group" }), "group");
  assert.equal(serverWorkspaceScope({ isPersonal: false, groupId: null }), "project");
});

test("server delivery retries only transient failures with bounded backoff", () => {
  assert.equal(isRetryableDeliveryStatus(400), false);
  assert.equal(isRetryableDeliveryStatus(429), true);
  assert.equal(isRetryableDeliveryStatus(503), true);
  assert.equal(nextDeliveryDelayMs(1), 2_000);
  assert.equal(nextDeliveryDelayMs(20), 60 * 60 * 1000);
});

test("server delivery uses direct Mixpanel import and a secret Discord webhook", async () => {
  const dispatcher = await readFile(new URL("./server-analytics-dispatcher.ts", import.meta.url), "utf8");
  const queue = await readFile(new URL("./server-analytics.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("./auth.ts", import.meta.url), "utf8");
  const authConfig = await readFile(new URL("./auth.config.ts", import.meta.url), "utf8");

  assert.match(dispatcher, /https:\/\/api\.mixpanel\.com\/import/);
  assert.match(dispatcher, /\$insert_id: delivery\.event\.id/);
  assert.match(dispatcher, /ip: 0/);
  assert.match(dispatcher, /DISCORD_SERVER_EVENT_WEBHOOK_URL/);
  assert.match(dispatcher, /url\.hostname === "discord\.com"/);
  assert.match(dispatcher, /url\.protocol === "https:"/);
  assert.match(dispatcher, /allowed_mentions: \{ parse: \[\] \}/);
  assert.doesNotMatch(dispatcher, /NEXT_PUBLIC_.*(SECRET|WEBHOOK)/);
  assert.match(queue, /create: \[\s*\{ destination: "MIXPANEL" \},\s*\{ destination: "DISCORD" \}/);
  assert.match(auth, /events: \{\s*async signIn/);
  assert.match(auth, /"Authentication Succeeded"/);
  assert.match(authConfig, /pathname === "\/api\/cron\/server-analytics"/);
});

test("local and Turso outbox migrations stay identical", async () => {
  const local = await readFile(new URL("../../prisma/migrations/0002_server_analytics_outbox/migration.sql", import.meta.url), "utf8");
  const turso = await readFile(new URL("../../prisma/turso/0002_server_analytics_outbox.sql", import.meta.url), "utf8");
  assert.equal(local, turso);
});
