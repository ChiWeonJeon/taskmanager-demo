import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next (use `**/` so nested copies are
    // also skipped — the deploy runs `npm run lint` from the repo root, which
    // physically contains Claude Code worktrees under `.claude/worktrees/*`,
    // each with their own build output that must not be linted).
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/node_modules/**",
    "next-env.d.ts",
    // Prisma-generated client (gitignored, regenerated per build). Linting it
    // is meaningless and trips ban-ts-comment on its @ts-ignore output.
    "**/src/generated/**",
    // Claude Code worktrees nested inside the repo dir on the deploy box.
    ".claude/**",
  ]),
]);

export default eslintConfig;
