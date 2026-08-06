# Production-readiness audit

This repository currently contains two incompatible application backends:

- The React application authenticates and manages profiles through Supabase.
- The `server/` application authenticates its separate Prisma `User` records with JWTs.

They do not share identity, sessions, content records, or API calls. A deployment must select one source of truth before it can truthfully be described as an integrated education platform. The current browser application is Supabase-first, so the least disruptive path is to add Supabase migrations/RPCs for contests, problems, courses, enrollment, submissions, analytics, and notifications, then remove the duplicate Express authentication stack. Alternatively, migrate the browser application to the Express API and remove Supabase client writes.

## Findings that still require infrastructure or product decisions

1. Static catalogue, contest, leaderboard, rating, analytics, achievement, notification, and quiz files in `src/data/` are presentation fixtures, not persisted content. They require a content migration and repository/API layer before CRUD can be complete.
2. The Prisma schema has no committed database migration. It validates after supplying `DATABASE_URL`, but a real PostgreSQL database must receive a reviewed migration before the server can run it.
3. The judge requires a dedicated Docker-capable worker host, image pinning/scanning, queue monitoring, and per-language resource policies. It must not run in the web-process container in production.
4. Payments, outbound email delivery, object storage, backups, observability, and legal/privacy workflows are not configured. Provider credentials and policy decisions are required.
5. The current local Prisma CLI exits successfully without producing a client in this execution environment. CI must run `prisma generate` and fail if the generated client does not contain the platform delegates before compiling or deploying the server.

## Changes made in this audit

- Repaired the Prisma relation graph and added important relational uniqueness/index invariants.
- Hardened JWT configuration and refresh-session rotation, removed permissive production CORS, and made refresh cookies scoped and `HttpOnly`.
- Prevented public course/internal lesson, contest password/editorial, and cross-user submission data exposure.
- Enforced idempotent course enrollment/progress writes and protected notification publishing.
- Added judge container hardening flags and a Docker spawn error path.
- Removed fabricated security incidents/device logs from the admin UI and guarded the admin page behind the server-enforced Supabase access check.
- Fixed contest workspace routing and code-split page bundles.
