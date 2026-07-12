# Codebase map

TaskManager Demo is a Next.js application with App Router route handlers, Prisma models, and a Turso-backed libSQL runtime. Public authentication resolves one fixed Viewer identity from the synthetic dataset. Middleware protects all private reads, blocks admin routes, and rejects API mutations while demo read-only mode is enabled.

The primary product areas are work items, projects and groups, cycles, checklists, activity, notifications, saved views, and schema metadata. The seed provides a coherent Project Aetherfall portfolio across all these surfaces: 90 work items, 12 assignees, 18 shared views, 122 activity entries, and task references distributed across all six cycles.

`scripts/verify-demo-data.ts` is the seed coverage guard. It checks Today buckets, current-month Calendar density, Saved View scopes and modes, Activity timeline breadth, assignee distribution, comments/history, and Cycle references against the active local or Turso database.
