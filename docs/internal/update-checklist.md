# Update checklist

- Update `VERSION`, `CHANGELOG.md`, README when applicable, and internal docs.
- Add all UI copy to the English language pack and Korean/Japanese overrides.
- Preserve server-side read-only enforcement and the Viewer permission boundary.
- Keep all data fictional and use only `aetherfall.example` identities.
- For schema changes, update local and Turso SQL artifacts together.
- After changing synthetic data, run the seed twice and run `npm run db:verify-demo` against both local SQLite and Turso before deployment.
- Run `npm run lint`, `npm test`, `npm run build`, and `npm run scan:public`.
- Verify login, representative read routes, mutation rejection, and `/api/health` in a browser.
