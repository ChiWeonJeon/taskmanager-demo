# Database migration guardrails

Prisma CLI operates on local SQLite through `LOCAL_DATABASE_URL`. Runtime access uses the libSQL adapter with Turso credentials.

For a schema change, generate and validate SQL locally, add the ordered equivalent under `prisma/turso/`, and apply it explicitly with `npm run db:migrate:turso`. Applied remote SQL is immutable; checksum drift is a release blocker. Seeding is a separate explicit action and must remain idempotent. Never schedule migration, seed, or reset operations.
