#!/usr/bin/env node
/*
 * Enforces the i18n convention (CLAUDE.md §9): no hardcoded Korean/Japanese
 * user-facing strings in src/**\/*.{ts,tsx}. The language pack lives in
 * src/lib/i18n/messages.ts; UI code must read strings through useI18n() or
 * getServerMessages() instead of embedding literal Korean/Japanese text.
 *
 * - Skips: comments (// and block), string keys in messages.ts itself,
 *   test files, and files explicitly listed in ALLOWLIST below.
 * - Exits non-zero when a violation is found so `npm run lint` fails.
 *
 * Allowlist note (ai-followup): files below still contain hardcoded
 * Korean. Shrink this list as they are migrated. New code must not be added
 * here — the default for fresh features is "no hardcoded labels".
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = process.cwd();
const SRC_DIR = join(REPO_ROOT, "src");

// Matches Hangul syllables and Japanese hiragana/katakana/common CJK.
// We intentionally check both since messages.ts carries ko/ja; any hardcoded
// CJK string in a component is a bypass of the language pack.
const CJK_REGEX = /[가-힣ぁ-んァ-ヶ]/;

// Files that legitimately contain CJK (the language pack itself) or are
// DB-role-name lookups for backward compatibility. Paths are POSIX-style
// relative to repo root.
const EXEMPT_FILES = new Set([
  "src/lib/i18n/messages.ts",
  "src/lib/date.ts", // locale-specific day-name constants used by formatters
  "src/lib/group-permissions.ts", // Prisma queries reference legacy Korean role names
  "src/lib/project-permissions.ts", // same
  "src/lib/roles.ts", // default-role lookup references legacy Korean role name ("멤버")
  "src/components/rich-text/mention-extension.ts", // Japanese example in a comment
  "src/lib/auth.config.ts", // intentional inline locale map for edge middleware
]);

// Files known to still contain hardcoded strings. Migrate them and remove
// from this list. Do NOT add new entries — new features must go through the
// language pack from the start.
const ALLOWLIST = new Set([]);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // `generated/` contains Prisma-generated TypeScript that bundles the
      // inline `schema.prisma` (with Korean model-comment headers) as a string
      // literal, which would otherwise trip the CJK regex. Skip it outright —
      // generated artifacts are not source code.
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      results.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

function stripCommentsAndStringKeys(text) {
  // Remove // line comments and /* block */ comments so matches in comments
  // don't count. This is a best-effort pass; it's fine if a string literal
  // contains "//" since we only care about not flagging comment CJK.
  let out = "";
  let i = 0;
  let inString = null; // '"', "'", '`'
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

const files = walk(SRC_DIR);
const violations = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file).split(sep).join("/");
  if (EXEMPT_FILES.has(rel)) continue;
  if (ALLOWLIST.has(rel)) continue;
  const text = readFileSync(file, "utf8");
  if (!CJK_REGEX.test(text)) continue;
  const stripped = stripCommentsAndStringKeys(text);
  if (!CJK_REGEX.test(stripped)) continue;
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    if (CJK_REGEX.test(lines[idx])) {
      hits.push({ line: idx + 1, text: lines[idx].trim() });
    }
  }
  violations.push({ file: rel, hits });
}

if (violations.length === 0) {
  console.log("[i18n-check] OK — no hardcoded Korean/Japanese strings in src/.");
  process.exit(0);
}

console.error("[i18n-check] FAIL — hardcoded Korean/Japanese found:");
for (const v of violations) {
  console.error(`\n  ${v.file}`);
  for (const h of v.hits.slice(0, 5)) {
    console.error(`    L${h.line}: ${h.text}`);
  }
  if (v.hits.length > 5) console.error(`    ...and ${v.hits.length - 5} more`);
}
console.error("\nFix: route user-facing strings through useI18n() / getServerMessages().");
console.error("See CLAUDE.md §9 (i18n 규약) for details.");
process.exit(1);
