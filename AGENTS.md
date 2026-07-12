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

## Architecture

- `src/app`: Next.js pages and route handlers
- `src/components`: task, cycle, checklist, layout, and shared UI
- `src/lib/db.ts`: Prisma libSQL adapter and production configuration guard
- `src/lib/demo.ts`: demo identity and read-only flags
- `prisma/schema.prisma`: canonical data model
- `prisma/seed.ts`: idempotent Project Aetherfall synthetic seed
- `prisma/turso`: ordered remote migration SQL
- `scripts/turso-migrate.mjs`: checksum-verified migration runner
- `vercel.json`: single-region Vercel configuration

## Deployment

Vercel deploys `main`. Production requires `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `AUTH_URL`, `DEMO_MODE=true`, and `DEMO_READ_ONLY=true`. Database migrations and seeding are explicit operator actions and are never scheduled automatically.
