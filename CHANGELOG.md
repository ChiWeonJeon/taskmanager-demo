# Changelog

## 0.58.1 - 2026-07-13

- Routed browser analytics through a public same-origin Vercel rewrite to Mixpanel's US ingestion endpoint so common content blockers do not discard demo telemetry.
- Kept event creation in the browser and preserved DNT, local opt-out, IP suppression, explicit event allowlists, and the no-identify/no-replay policy.
- Added coverage for the proxy destination and unauthenticated ingestion path.

## 0.58.0 - 2026-07-13

- Added production-only anonymous Mixpanel analytics with browser-local device identity and an explicit local opt-out.
- Instrumented exactly 11 approved navigation and exploration events without autocapture, session replay, People profiles, IP geolocation, or user identification.
- Normalized dynamic routes, stripped queries and sensitive content, and limited every event to an explicit property allowlist.
- Added analytics unit coverage, multilingual consent copy, environment documentation, and public-demo operating guardrails.

## 0.57.0 - 2026-07-12

- Expanded Project Aetherfall to 90 work items assigned across 12 synthetic production roles.
- Distributed overdue, due-today, next-seven-day, unplanned, completed, and current-month calendar data across every project.
- Assigned every work item across all six production cycles and added richer comments, watchers, parent-child links, and history entries.
- Added 18 shared Saved Views covering personal, studio, group, and project scopes across List, Grid, Kanban, Calendar, and Gantt.
- Expanded project and group activity to 122 entries across eight event kinds, 12 actors, and 22 timeline dates.
- Added `npm run db:verify-demo` to enforce feature-level demo-data coverage after every manual seed.

## 0.56.1 - 2026-07-12

- Published the live Vercel Hobby demo at `taskmanager-demo-five.vercel.app` with Turso in AWS Tokyo.
- Recorded the production URL after verifying health, one-click login, AAA demo data, and read-only mutation enforcement.

## 0.56.0 - 2026-07-12

- Started the independent public demo from the verified service snapshot at commit `3891d891714a3f219af232b43b9e039bb0f051d4`.
- Added the synthetic Project Aetherfall AAA production dataset with 5 projects, 6 milestones, and 60 work items.
- Replaced local persistence with Prisma's libSQL adapter for Turso and added a checksum-verified baseline runner.
- Added one-click Viewer authentication and server-enforced read-only behavior.
- Removed private service navigation, internal user-management endpoints, local file uploads, and machine-specific deployment assets.
- Added Vercel configuration, public CI, safety scanning, and demo-specific documentation.
- Updated Next.js to the current stable security patch available at implementation time.
