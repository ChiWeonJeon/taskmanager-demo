# Changelog

## 0.56.0 - 2026-07-12

- Started the independent public demo from the verified service snapshot at commit `3891d891714a3f219af232b43b9e039bb0f051d4`.
- Added the synthetic Project Aetherfall AAA production dataset with 5 projects, 6 milestones, and 60 work items.
- Replaced local persistence with Prisma's libSQL adapter for Turso and added a checksum-verified baseline runner.
- Added one-click Viewer authentication and server-enforced read-only behavior.
- Removed private service navigation, internal user-management endpoints, local file uploads, and machine-specific deployment assets.
- Added Vercel configuration, public CI, safety scanning, and demo-specific documentation.
- Updated Next.js to the current stable security patch available at implementation time.
