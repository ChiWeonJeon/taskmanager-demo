import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const mainRoutesDir = fileURLToPath(new URL("../../app/(main)", import.meta.url));
const mainLayoutSource = readFileSync(join(mainRoutesDir, "layout.tsx"), "utf8");
const groupLayoutSource = readFileSync(join(mainRoutesDir, "groups/[groupSlug]/layout.tsx"), "utf8");
const projectLayoutSource = readFileSync(join(mainRoutesDir, "projects/[id]/layout.tsx"), "utf8");
const adminShellSource = readFileSync(fileURLToPath(new URL("../admin/admin-shell.tsx", import.meta.url)), "utf8");
const adminDetailShellSource = readFileSync(fileURLToPath(new URL("../admin/admin-detail-shell.tsx", import.meta.url)), "utf8");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectTsxFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("keeps the authenticated service width owned by MainLayout", () => {
  assert.ok(mainLayoutSource.includes('data-service-content="true"'));
  assert.ok(mainLayoutSource.includes('data-service-page-width="true"'));
  assert.ok(mainLayoutSource.includes('className="min-w-0 w-full"'));
  assert.ok(groupLayoutSource.includes('data-scope-page-content="group"'));
  assert.ok(groupLayoutSource.includes('data-scope-page-body="group"'));
  assert.ok(projectLayoutSource.includes('data-scope-page-content="project"'));
  assert.ok(projectLayoutSource.includes('data-scope-page-body="project"'));
});

test("rejects route-level outer width caps across authenticated pages", () => {
  const forbiddenWidth = /(?:\bmx-auto\b|\bmax-w-(?:lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b)/;
  const offenders = collectTsxFiles(mainRoutesDir)
    .filter((path) => path !== join(mainRoutesDir, "layout.tsx"))
    .filter((path) => forbiddenWidth.test(readFileSync(path, "utf8")))
    .map((path) => path.replace(`${mainRoutesDir}/`, ""));
  assert.deepEqual(offenders, []);
  assert.equal(forbiddenWidth.test(adminShellSource), false);
  assert.equal(forbiddenWidth.test(adminDetailShellSource), false);
});

test("aligns admin detail content and its sticky action bar to the service area", () => {
  assert.ok(adminShellSource.includes('data-service-page="admin"'));
  assert.ok(adminDetailShellSource.includes('data-service-page="admin-detail"'));
  assert.ok(adminDetailShellSource.includes('data-service-sticky-content="true"'));
  assert.ok(adminDetailShellSource.includes("md:left-[var(--sidebar-current-width)]"));
});
