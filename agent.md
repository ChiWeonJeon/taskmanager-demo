# agent.md

The canonical repository guidance is `AGENTS.md`.

1. Update `VERSION`, `CHANGELOG.md`, and affected documentation in every commit.
2. Route all user-visible text through the English, Korean, and Japanese language packs.
3. Keep the public demo synthetic, secret-free, and server-enforced read-only.
4. Update both local and Turso migration artifacts for schema changes; never edit applied Turso SQL.
5. Run lint, tests, build, and `scan:public` before publishing.
6. Keep this file synchronized with `AGENTS.md` rules.
