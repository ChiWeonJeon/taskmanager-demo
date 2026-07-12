import assert from "node:assert/strict";
import test from "node:test";
import { buildTaskPanelHref } from "@/lib/task-panel-route";

test("buildTaskPanelHref preserves current pathname and query params", () => {
  assert.equal(
    buildTaskPanelHref("/all-tasks", "view=calendar", "task-123"),
    "/all-tasks?view=calendar&task=task-123"
  );
});

test("buildTaskPanelHref replaces an existing task query in place", () => {
  assert.equal(
    buildTaskPanelHref("/tasks", "task=old&view=calendar", "new"),
    "/tasks?task=new&view=calendar"
  );
});
