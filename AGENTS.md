# AGENTS.md

## Required rules

1. Every commit updates `VERSION`, `CHANGELOG.md`, and affected documentation together.
2. User-visible text must use `src/lib/i18n/messages.ts` with English defaults and Korean/Japanese overrides.
3. The public demo remains synthetic and read-only. Never import real service data, identities, secrets, domains, or environment files.
4. `DEMO_READ_ONLY=true` must be enforced on the server; UI-only disabling is insufficient.
5. Database changes update `prisma/schema.prisma`, the local baseline or next local migration, the matching `prisma/turso/*.sql`, and database documentation.
6. Existing Turso migration files are immutable after application. The checksum runner must reject drift.
7. Run lint, tests, build, and `scan:public` before commit or deployment.
8. Keep `AGENTS.md` and `agent.md` synchronized.
9. Analytics remains production-only and anonymous. Track only the 11 documented explicit events; never add autocapture, replay, identify/alias/People/reset calls, PII, work-item content, full URLs, query values, or raw filter values.

## Architecture

- `src/app`: Next.js pages and route handlers
- `src/components`: task, cycle, checklist, layout, and shared UI
- `src/lib/db.ts`: Prisma libSQL adapter and production configuration guard
- `src/lib/demo.ts`: demo identity and read-only flags
- `src/lib/analytics-core.ts`: event catalog, route normalization, and property allowlists
- `src/lib/analytics.ts`: production-only Mixpanel initialization, tracking, and local opt-out
- `src/components/shared/analytics-provider.tsx`: route-change page measurement
- `prisma/schema.prisma`: canonical data model
- `prisma/seed.ts`: idempotent Project Aetherfall synthetic seed
- `prisma/turso`: ordered remote migration SQL
- `scripts/turso-migrate.mjs`: checksum-verified migration runner
- `scripts/verify-demo-data.ts`: Today, Calendar, Saved View, Activity, assignee, and Cycle coverage guard
- `vercel.json`: single-region Vercel configuration

## Deployment

Vercel deploys `main`. Production requires `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `AUTH_URL`, `DEMO_MODE=true`, and `DEMO_READ_ONLY=true`. Anonymous analytics additionally uses `NEXT_PUBLIC_MIXPANEL_TOKEN` and `NEXT_PUBLIC_MIXPANEL_ENABLED=true` in Production only. Database migrations and seeding are explicit operator actions and are never scheduled automatically.
