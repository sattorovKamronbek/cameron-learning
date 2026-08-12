# Cameron Learning

Cameron is a Vite/React learning platform backed by Supabase for authentication,
profiles, contests, notifications, and the protected administration console.

The browser application uses Supabase as its only runtime backend. The legacy
`server/` directory is an unintegrated prototype and is not part of this
deployment path.

## Run locally

1. Copy `.env.example` to `.env` and add the Supabase project URL plus its
   publishable/anon key.
2. Install dependencies with `npm ci`.
3. Start the site with `npm run dev`.

Before deploying, apply every SQL file in `supabase/migrations/` to the same
Supabase project. The latest hardening migration is intentionally required for
the admin console.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Create the first private administrator

Follow [the secure admin setup guide](docs/ADMIN_SETUP.md). The account email
and password are generated at provisioning time and are never stored in this
repository or exposed to browser code.
