#!/usr/bin/env node
/*
 * Keeps common UI drift out of src/:
 * - arbitrary pixel font sizes instead of text tokens
 * - raw Tailwind palette classes where semantic tokens should be used
 * - visible glyph/emoji icon shortcuts instead of SVG icon components
 * - hand-built dialog overlays outside approved shell primitives
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = process.cwd();
const SRC_DIR = join(REPO_ROOT, "src");

const TEXT_PIXEL_REGEX = /(?:text-\[[0-9.]+px\]|font-size:\s*[0-9.]+px)/;
const RAW_PALETTE_REGEX = /\b(?:bg|border|text)-(?:red|blue|amber|purple|sky|rose|green|gray)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;
const GLYPH_ICON_REGEX = /[📋📁🗂️✏️⚙️👤☀️🌙👁🔔📄⋮⋯«»↪▲▼↕ℹ✓⚠✕×⊞▸▾↑↓←]/u;
const HAND_BUILT_OVERLAY_REGEX = /(?:fixed\s+inset-0|role=["']dialog["']|aria-modal=["']true["'])/;

const SKIP_DIRS = new Set(["node_modules", ".next", "generated"]);
const SOURCE_FILE_REGEX = /\.(ts|tsx|css)$/;
const EXEMPT_GLYPH_FILES = new Set([
  "src/lib/i18n/messages.ts",
]);
const ALLOWED_OVERLAY_FILES = new Set([
  "src/components/ui/modal.tsx",
  "src/components/ui/context-menu.tsx",
  "src/components/layout/mobile-nav.tsx",
  "src/components/shared/detail-panel-shell.tsx",
  "src/components/task/task-workspace.tsx",
]);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      results.push(...walk(full));
    } else if (SOURCE_FILE_REGEX.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function stripComments(text) {
  let out = "";
  let i = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\" && next) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function collectHits(rel, text, checks) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    for (const check of checks) {
      if (check.regex.test(line)) {
        hits.push({ file: rel, line: idx + 1, label: check.label, text: line.trim() });
      }
    }
  }
  return hits;
}

const violations = [];

for (const file of walk(SRC_DIR)) {
  const rel = relative(REPO_ROOT, file).split(sep).join("/");
  const text = readFileSync(file, "utf8");
  const stripped = stripComments(text);
  const checks = [
    { label: "pixel font size", regex: TEXT_PIXEL_REGEX },
    { label: "raw Tailwind palette", regex: RAW_PALETTE_REGEX },
  ];
  if (!EXEMPT_GLYPH_FILES.has(rel)) {
    checks.push({ label: "glyph icon shortcut", regex: GLYPH_ICON_REGEX });
  }
  if (!ALLOWED_OVERLAY_FILES.has(rel)) {
    checks.push({ label: "hand-built dialog overlay", regex: HAND_BUILT_OVERLAY_REGEX });
  }
  violations.push(...collectHits(rel, stripped, checks));
}

if (violations.length === 0) {
  console.log("[design-system-drift] OK - no font/palette/glyph/overlay drift found.");
  process.exit(0);
}

console.error("[design-system-drift] FAIL - design-system drift found:");
for (const hit of violations.slice(0, 80)) {
  console.error(`  ${hit.file}:${hit.line} [${hit.label}] ${hit.text}`);
}
if (violations.length > 80) {
  console.error(`  ...and ${violations.length - 80} more`);
}
console.error("\nUse CSS tokens, semantic color variables, shared SVG icons, and Modal/approved shells.");
process.exit(1);
