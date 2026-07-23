# Changelog

## 0.59.0 - 2026-07-23

- Split analytics governance into the existing 11 browser UI events and a separate five-event server business catalog that remains disabled in the public demo.
- Added a transactional server-event outbox with HMAC-pseudonymous actor IDs, explicit property allowlists, independent Mixpanel and Discord delivery state, leases, bounded retries, and dead-letter handling.
- Added direct, strict Mixpanel Import API delivery with stable deduplication IDs and IP enrichment disabled.
- Added secret-backed Discord notifications for every queued server event, restricted to HTTPS Discord webhook hosts, with mentions disabled and content, identity, and credentials excluded.
- Instrumented successful authentication plus confirmed project creation, work-item creation/update, and checklist-run completion transactions; the synthetic Viewer login remains excluded by the demo guard.
- Added a protected recovery endpoint, daily Vercel recovery schedule, schema migrations, environment documentation, focused analytics coverage, and a public-scan guard against committed Discord webhook credentials.

## 0.58.4 - 2026-07-13

- Fixed clipped calendar cell content on mobile and desktop by reserving a measured row for the `+N More` overflow control and preventing its localized label from wrapping.
- Added focused layout coverage for overflowing, exact-fit, and single-row calendar cells.

## 0.58.3 - 2026-07-13

- Removed the post-opt-out analytics confirmation copy from the login screen in every locale.
- Hid the complete analytics disclosure block after browser-local opt-out while preserving profile deletion and tracking suppression.
- Added coverage preventing the removed confirmation message from returning.

## 0.58.2 - 2026-07-13

- Added a minimal Mixpanel People profile for each anonymous browser so the Users view can display browser-scoped visitors without real names, emails, account IDs, or cross-device merging.
- Reused the existing persisted `$device:` distinct ID when enabling People updates, preserving the current browser-local unique-user model and avoiding shared Demo Viewer identification.
- Updated analytics disclosure and opt-out behavior so opting out also deletes the anonymous browser profile.
- Added coverage for device-only profile naming, profile-property restrictions, and forbidden shared identity paths.

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
