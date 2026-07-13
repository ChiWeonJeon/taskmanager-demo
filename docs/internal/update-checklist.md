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
- When analytics changes, confirm the product event catalog remains exactly 11, route templates contain no identifiers or queries, event and People allowlists exclude content/PII, opt-out stops sends and deletes the browser profile, and no shared-Viewer identify, alias, reset, autocapture, or replay path exists.
- Verify every People update reuses the current `$device:` distinct ID, creates separate profiles for separate browser stores, and never merges devices or transmits account identifiers.
- Verify login opt-out removes the full analytics disclosure block without rendering a confirmation sentence.
- Verify `/mp/track/` forwards to Mixpanel US with `ip=0`, remains public without opening other routes, and never contains server-side event generation or persistence.
