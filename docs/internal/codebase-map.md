# Codebase map

TaskManager Demo is a Next.js application with App Router route handlers, Prisma models, and a Turso-backed libSQL runtime. Public authentication resolves one fixed Viewer identity from the synthetic dataset. Middleware protects all private reads, blocks admin routes, and rejects API mutations while demo read-only mode is enabled.

The primary product areas are work items, projects and groups, cycles, checklists, activity, notifications, saved views, and schema metadata. The seed provides a coherent Project Aetherfall portfolio across all these surfaces: 90 work items, 12 assignees, 18 shared views, 122 activity entries, and task references distributed across all six cycles.

`scripts/verify-demo-data.ts` is the seed coverage guard. It checks Today buckets, current-month Calendar density, Saved View scopes and modes, Activity timeline breadth, assignee distribution, comments/history, and Cycle references against the active local or Turso database.

Anonymous browser analytics is isolated in `src/lib/analytics-core.ts`, `src/lib/analytics.ts`, and `src/components/shared/analytics-provider.tsx`. The core module owns the exact 11-event catalog, dynamic route templates, workspace scope derivation, per-event property allowlists, and synthetic browser-profile label. The browser module initializes Mixpanel only when both public production variables are present, creates one minimal People profile on the unchanged `$device:` distinct ID, and owns persistent local opt-out/profile deletion. Feature components emit events only after successful, distinct UI state changes.

Production analytics posts to the same-origin `/mp/*` path. `vercel.json` forwards that path unchanged to Mixpanel's US ingestion API, while `src/lib/auth.config.ts` keeps only this forwarding path public. The rewrite does not create, enrich, or store events.

The People profile allowlist is `$name` (synthetic `Demo Browser XXXXXX`), `profile_type`, `identity_scope`, `app_version`, `locale`, `demo_mode`, and `read_only`. `identify()` may only receive the already persisted `$device:` distinct ID so profile updates are flushed without introducing a known ID or merging devices. The shared Demo Viewer ID and all account or task data are forbidden.
