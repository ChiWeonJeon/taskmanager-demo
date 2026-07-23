# Codebase map

TaskManager Demo is a Next.js application with App Router route handlers, Prisma models, and a Turso-backed libSQL runtime. Public authentication resolves one fixed Viewer identity from the synthetic dataset. Middleware protects all private reads, blocks admin routes, and rejects API mutations while demo read-only mode is enabled.

The primary product areas are work items, projects and groups, cycles, checklists, activity, notifications, saved views, and schema metadata. The seed provides a coherent Project Aetherfall portfolio across all these surfaces: 90 work items, 12 assignees, 18 shared views, 122 activity entries, and task references distributed across all six cycles.

`scripts/verify-demo-data.ts` is the seed coverage guard. It checks Today buckets, current-month Calendar density, Saved View scopes and modes, Activity timeline breadth, assignee distribution, comments/history, and Cycle references against the active local or Turso database.

Anonymous browser analytics is isolated in `src/lib/analytics-core.ts`, `src/lib/analytics.ts`, and `src/components/shared/analytics-provider.tsx`. The core module owns the exact 11-event catalog, dynamic route templates, workspace scope derivation, per-event property allowlists, and synthetic browser-profile label. The browser module initializes Mixpanel only when both public production variables are present, creates one minimal People profile on the unchanged `$device:` distinct ID, and owns persistent local opt-out/profile deletion. Feature components emit events only after successful, distinct UI state changes.

Browser production analytics posts to the same-origin `/mp/*` path. `vercel.json` forwards that path unchanged to Mixpanel's US ingestion API, while `src/lib/auth.config.ts` limits public analytics paths to that forwarding path and the separately secret-protected recovery route. The rewrite does not create, enrich, or store events.

Non-demo server business analytics is isolated in `src/lib/server-analytics-core.ts`, `src/lib/server-analytics.ts`, and `src/lib/server-analytics-dispatcher.ts`. The core module owns the separate five-event catalog, property allowlists, demo/preview guards, workspace scopes, and retry policy. Domain mutations create `ServerAnalyticsEvent` plus independent Mixpanel and Discord `ServerAnalyticsDelivery` rows in the same Prisma transaction. Actor IDs are HMAC-pseudonymized before storage; raw IDs, content, email, IP addresses, and URLs are not outbox properties.

The dispatcher leases due deliveries, sends Mixpanel events directly through the strict Import API with the outbox ID as `$insert_id` and `ip=0`, and sends minimal Discord embeds through a server-only webhook URL. Successful route handlers request an immediate background drain. `/api/cron/server-analytics` is public only at the middleware boundary and requires `CRON_SECRET`; Vercel invokes it daily as recovery. Both collection and dispatch refuse to run in demo/read-only mode.

The People profile allowlist is `$name` (synthetic `Demo Browser XXXXXX`), `profile_type`, `identity_scope`, `app_version`, `locale`, `demo_mode`, and `read_only`. `identify()` may only receive the already persisted `$device:` distinct ID so profile updates are flushed without introducing a known ID or merging devices. The shared Demo Viewer ID and all account or task data are forbidden.

The login disclosure is rendered only while browser analytics is active. Opt-out deletes the anonymous profile, persists suppression in local storage, and removes the disclosure block without showing a replacement confirmation message.

Calendar month and week layouts measure the available row capacity with `ResizeObserver`. `resolveCalendarCellLaneVisibility` treats that capacity as the combined budget for task lanes and the `+N More` control, reserving one row whenever a cell contains hidden entries. The overflow label is constrained to one line so longer localized copy cannot exceed the cell height on mobile.
