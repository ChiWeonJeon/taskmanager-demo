# Release compliance

A release is complete only when source, `VERSION`, changelog, README version, CI, Turso schema, Vercel deployment, and `/api/health` agree. Verify that the production database reports healthy, demo and read-only flags are true, one-click login works, admin routes remain inaccessible, and mutation requests return `403`.

Before publishing a public commit, run the safety scan and inspect the staged diff for identities, domains, credentials, database files, generated secrets, and machine-specific paths.
