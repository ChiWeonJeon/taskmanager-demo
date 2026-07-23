# TaskManager Demo

TaskManager Demo is a read-only public showcase of a schema-driven production workspace. The synthetic `Project Aetherfall` dataset models an AAA open-world action RPG across gameplay, world, art, platform, QA, certification, and release teams.

No real company, person, customer, project, or production record is included. Public visitors sign in through a one-click Viewer session and cannot mutate server data. The dataset is not reset automatically.

Live demo: [taskmanager-demo-five.vercel.app](https://taskmanager-demo-five.vercel.app)

## Demo data coverage

- 90 Story, Task, and Bug records across five production projects
- 12 synthetic assignees spanning executive production, game direction, engineering, art, narrative, online, QA, cinematics, audio, platform, and release
- Due-by-today, overdue, next-seven-day, unplanned, completed, and current-month calendar scenarios
- 18 shared Saved Views across personal, studio, group, and project workspaces
- 122 project/group activity entries across 22 timeline dates
- Every work item assigned across Vertical Slice, First Playable, Alpha, Content Complete, Beta & Certification, or Gold Master

## Snapshot

- Source service version at implementation start: `0.55.3`
- Source commit: `3891d891714a3f219af232b43b9e039bb0f051d4`
- Verified: 2026-07-12 Asia/Seoul
- This repository starts from a cleaned source snapshot and intentionally contains no source repository history or remote linkage.

## Stack

- Next.js 16, React 19, TypeScript 5
- Prisma 7 with the libSQL adapter
- Turso for hosted SQLite-compatible persistence
- NextAuth JWT with a demo-only credentials provider
- Vercel for build and hosting
- Mixpanel Browser SDK for anonymous UI analytics and direct server ingestion for non-demo business events

## Local setup

```bash
npm ci
cp .env.example .env
npm run db:bootstrap-local
npm run dev
```

Open `http://localhost:3000`, select **Explore the AAA project**, and browse the seeded workspace.

## Turso setup

1. Create a Turso database in a region near the Vercel Function region.
2. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` locally.
3. Run `npm run db:migrate:turso` once.
4. Run `npm run db:seed` explicitly once.
5. Run `npm run db:verify-demo` to confirm feature-level coverage.
6. Configure the same credentials in Vercel with `AUTH_SECRET`, `AUTH_URL`, `DEMO_MODE=true`, and `DEMO_READ_ONLY=true`.

Schema changes are generated against local SQLite. Turso SQL files live in `prisma/turso/` and are applied by a checksum-verified runner.

## Anonymous analytics

Analytics is a production-only, opt-out measurement of public demo visits and core exploration. Configure `NEXT_PUBLIC_MIXPANEL_TOKEN` and `NEXT_PUBLIC_MIXPANEL_ENABLED=true` only for the Vercel Production environment. Preview, CI, and local development remain no-op by default.

Mixpanel's anonymous `$device_id` persists in same-origin browser local storage. It measures a browser, not a person: another device, browser, private window, or cleared storage is counted separately. The shared Demo Viewer account is never used for analytics identity, and devices are never merged through that account.

Each participating browser creates one minimal Mixpanel People profile using its existing `$device:` distinct ID. The profile contains only a synthetic display label, profile type, browser-storage scope, app version, locale, and demo/read-only flags. It never contains an account ID, email, real name, task content, or other personal data. The SDK calls `identify()` only with the unchanged current `$device:` ID to flush the profile update; it does not introduce a known user ID or merge browsers.

Browser events use the same-origin `/mp/*` path, which Vercel rewrites to Mixpanel's US ingestion API. The rewrite only forwards the existing sanitized browser payload and does not add server-side events. Browser DNT and the local opt-out remain authoritative.

The login page provides a browser-local opt-out. Opting out persists in local storage, stops future sends from that browser, and deletes its anonymous People profile. Collection is immediate until the visitor opts out. IP enrichment, autocapture, session replay, full URLs, queries, referrers, task content, account IDs, personal data, email, and raw filter values are excluded.

The explicit event catalog is limited to:

- `Page Viewed`
- `Demo Entered`
- `Task Opened`
- `Task View Mode Changed`
- `Today Bucket Selected`
- `Saved View Applied`
- `Task Filter Applied`
- `Task Sort Changed`
- `Task Group Changed`
- `Cycle Opened`
- `Activity Filter Changed`

## Server business analytics

Non-demo production deployments may create server business events after confirmed database state transitions. Event creation uses a transactional outbox, HMAC-pseudonymous actor IDs, and a separate five-event allowlist:

- `Authentication Succeeded`
- `Project Created`
- `Work Item Created`
- `Work Item Updated`
- `Checklist Run Completed`

`Authentication Succeeded` is hooked after successful authentication, while the shared synthetic Viewer login remains excluded by the demo guard. Project creation, work-item creation/update, and checklist-run completion enqueue their events in the same transaction as the domain change.

The dispatcher sends events directly to Mixpanel's strict Import API with a stable `$insert_id`, `ip=0`, leases, bounded retries, and permanent-failure state. Each server event also receives an independent Discord delivery record. Discord notifications contain only the event name, event ID, time, environment, and app version; they exclude identities, work-item content, arbitrary properties, URLs, and credentials.

Server analytics requires `SERVER_ANALYTICS_ENABLED=true`, `SERVER_ANALYTICS_ID_SALT`, `MIXPANEL_SERVER_PROJECT_ID`, `MIXPANEL_SERVER_USERNAME`, and `MIXPANEL_SERVER_SECRET`. Discord additionally requires `SERVER_EVENT_NOTIFICATIONS_ENABLED=true` and `DISCORD_SERVER_EVENT_WEBHOOK_URL`. The recovery route requires `CRON_SECRET`. All are server-only variables. The public demo keeps both server flags disabled, and the runtime guard also refuses collection whenever `DEMO_MODE=true` or `DEMO_READ_ONLY=true`.

Successful requests schedule an immediate background drain. A secret-protected daily Vercel cron invocation recovers expired leases and pending deliveries within the public demo's Hobby-plan scheduling limit; a non-demo deployment that requires a tighter recovery objective may configure a more frequent schedule on an eligible plan.

## Verification

```bash
npm run lint
npm test
npm run db:verify-demo
npm run build
npm run scan:public
```

## Version

`0.59.0`
