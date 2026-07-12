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

## Verification

```bash
npm run lint
npm test
npm run db:verify-demo
npm run build
npm run scan:public
```

## Version

`0.57.0`
