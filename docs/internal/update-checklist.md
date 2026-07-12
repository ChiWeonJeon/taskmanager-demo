# Update checklist

- Update `VERSION`, `CHANGELOG.md`, README when applicable, and internal docs.
- Add all UI copy to the English language pack and Korean/Japanese overrides.
- Preserve server-side read-only enforcement and the Viewer permission boundary.
- Keep all data fictional and use only `aetherfall.example` identities.
- For schema changes, update local and Turso SQL artifacts together.
- After changing synthetic data, run the seed twice and run `npm run db:verify-demo` against both local SQLite and Turso before deployment.
- Run `npm run lint`, `npm test`, `npm run build`, and `npm run scan:public`.
- Verify login, representative read routes, mutation rejection, and `/api/health` in a browser.
- Keep analytics disabled in Preview, CI, and default local environments; set its two public variables in Vercel Production only.
- When analytics changes, confirm the event catalog remains exactly 11, route templates contain no identifiers or queries, property allowlists exclude content/PII, opt-out stops sends, and no identify/alias/People/reset/autocapture/replay path exists.
