import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const apiPath = fileURLToPath(new URL("./api.ts", import.meta.url));
const groupLayoutPath = fileURLToPath(new URL("../../app/(main)/groups/[groupSlug]/layout.tsx", import.meta.url));
const groupTabNavPath = fileURLToPath(new URL("../../app/(main)/groups/[groupSlug]/group-tab-nav.tsx", import.meta.url));

test("group cycle access stays gated by project cycle read permission", () => {
  const apiSource = readFileSync(apiPath, "utf8");
  const layoutSource = readFileSync(groupLayoutPath, "utf8");
  const tabSource = readFileSync(groupTabNavPath, "utf8");

  assert.ok(apiSource.includes("export async function canReadGroupCycles"));
  assert.ok(apiSource.includes("if (canReadCycle(await getProjectAccess(project.id, user))) return true;"));
  assert.ok(apiSource.includes('code: "CYCLE_FORBIDDEN"'));
  assert.ok(layoutSource.includes("const canAccessCycle = await canReadGroupCycles(access, session?.user);"));
  assert.ok(layoutSource.includes("canAccessCycle={canAccessCycle}"));
  assert.ok(tabSource.includes("canAccessCycle: boolean"));
  assert.ok(tabSource.includes("...(canAccessCycle"));
});
