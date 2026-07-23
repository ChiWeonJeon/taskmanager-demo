# Update checklist

- Update `VERSION`, `CHANGELOG.md`, README when applicable, and internal docs.
- Add all UI copy to the English language pack and Korean/Japanese overrides.
- Preserve server-side read-only enforcement and the Viewer permission boundary.
- Keep all data fictional and use only `aetherfall.example` identities.
- For schema changes, update local and Turso SQL artifacts together.
- After changing synthetic data, run the seed twice and run `npm run db:verify-demo` against both local SQLite and Turso before deployment.
- Run `npm run lint`, `npm test`, `npm run build`, and `npm run scan:public`.
- Verify login, representative read routes, mutation rejection, and `/api/health` in a browser.
- Keep browser analytics disabled in Preview, CI, and default local environments; set its two public variables in Vercel Production only.
- When browser analytics changes, confirm its product event catalog remains exactly 11, route templates contain no identifiers or queries, event and People allowlists exclude content/PII, opt-out stops sends and deletes the browser profile, and no shared-Viewer identify, alias, reset, autocapture, or replay path exists.
- Verify every People update reuses the current `$device:` distinct ID, creates separate profiles for separate browser stores, and never merges devices or transmits account identifiers.
- Verify login opt-out removes the full analytics disclosure block without rendering a confirmation sentence.
- Verify `/mp/track/` forwards browser events to Mixpanel US with `ip=0`, remains public without opening other routes, and never contains server-side event generation or persistence.
- Keep server business analytics disabled in the public demo, Preview, CI, and default local environments. Verify both enqueue and dispatch reject `DEMO_MODE=true` and `DEMO_READ_ONLY=true`.
- When server analytics changes, confirm the catalog remains exactly five events, every property is allowlisted, actor IDs are HMAC-pseudonymous, outbox creation shares the domain transaction, and raw IDs, content, PII, IP addresses, URLs, and credentials never enter payloads or logs.
- Verify every server event creates independent Mixpanel and Discord deliveries, Mixpanel uses strict import with stable `$insert_id` and `ip=0`, Discord disables mentions, transient failures retry, permanent failures stop, and expired leases recover.
- Verify `/api/cron/server-analytics` requires `CRON_SECRET`, no analytics or webhook secret uses `NEXT_PUBLIC_`, and the committed Discord webhook value remains empty.
- When calendar density or sizing changes, verify cells with overflow reserve space for `+N More` at desktop and mobile widths and that every `.calendar-entry-region` has `scrollHeight <= clientHeight`.
