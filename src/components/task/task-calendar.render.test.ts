import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const taskCalendarPath = fileURLToPath(new URL("./task-calendar.tsx", import.meta.url));
const globalsCssPath = fileURLToPath(new URL("../../app/globals.css", import.meta.url));
const tokensCssPath = fileURLToPath(new URL("../../styles/tokens.css", import.meta.url));

test("task calendar source keeps restored interaction and density hooks", () => {
  const source = readFileSync(taskCalendarPath, "utf8");

  assert.ok(source.includes("calendar-entry-chip"));
  assert.ok(source.includes("calendar-date-button"));
  assert.ok(source.includes("calendar-more-button"));
  assert.ok(source.includes("data-calendar-date-button"));
  assert.ok(source.includes("onSelectDate"));
  assert.ok(source.includes("data-display-unit={displayUnit}"));

  assert.ok(!source.includes("calendar-create-chip"));
  assert.ok(!source.includes("calendar-create-button"));
  assert.ok(!source.includes("resolveCreateIntent"));
  assert.ok(!source.includes('data-visible={showCreatePreview ? "true" : "false"}'));
  assert.ok(!source.includes("text-[length:var(--text-3xs)]"));
  assert.ok(!source.includes("text-[length:var(--text-3xs)]"));
  assert.ok(!source.includes("text-[length:var(--text-3xs)]"));
  assert.ok(!source.includes("h-[14px]"));
});

test("calendar density styles stay in globals and tokens", () => {
  const globalsSource = readFileSync(globalsCssPath, "utf8");
  const tokensSource = readFileSync(tokensCssPath, "utf8");

  assert.ok(globalsSource.includes("text-size-adjust: 100%"));
  assert.ok(globalsSource.includes(".calendar-density-root"));
  assert.ok(globalsSource.includes(".calendar-entry-chip"));
  assert.ok(globalsSource.includes(".calendar-date-button"));
  assert.ok(globalsSource.includes(".calendar-entry-bridge-left"));
  assert.ok(globalsSource.includes('[data-display-unit="day"]'));
  assert.ok(!globalsSource.includes("calendar-create-chip"));
  assert.ok(!globalsSource.includes("calendar-create-button"));

  assert.ok(tokensSource.includes("--text-3xs"));
  assert.ok(tokensSource.includes("--calendar-entry-height-compact"));
  assert.ok(tokensSource.includes("--calendar-month-cell-min-height-compact"));
});
