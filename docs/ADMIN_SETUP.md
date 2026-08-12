# Secure administrator setup

The admin console requires all of these server-side conditions:

1. A real Supabase Auth account with a confirmed email and password.
2. An active `profiles` row with `role = 'admin'`.
3. The account's current email in `admin_emails`.

The latest migration, `20260807213000_harden_admin_access.sql`, enforces this
combination for every dashboard RPC. It also revokes the old committed bootstrap
addresses, so provision the new administrator immediately after applying it.

## One-time provisioning

1. Apply all repository migrations to the target Supabase project through your
   normal migration deployment process. With the Supabase CLI, initialize this
   directory once (it creates the local `supabase/config.toml`), then link and
   preview the deployment before applying it:

   ```bash
   npx supabase@latest init
   npx supabase@latest login
   npx supabase@latest link --project-ref your-project-ref
   npx supabase@latest db push --dry-run
   npx supabase@latest db push
   ```

   This requires a Supabase account/database credential with migration access;
   a browser publishable key is intentionally insufficient. Confirm that
   `20260807213000_harden_admin_access.sql` has been applied before continuing.
2. Temporarily add the project **service-role** key to the local `.env` file:

   ```dotenv
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

   This is a server-only secret. Never prefix it with `VITE_`, commit it, or add
   it to a browser deployment.
3. Run:

   ```bash
   npm run admin:provision
   ```

   With no `ADMIN_EMAIL` or `ADMIN_PASSWORD`, the command creates a unique
   private login email and a strong random password, confirms the Auth email,
   and atomically makes that account the **only** application administrator.
   It removes old allowlist entries and demotes old admin-role profiles, then
   prints the credentials once; save them to a password manager immediately.
   This is intentionally exclusive—do not run it on a shared production
   project unless replacing every existing administrator is desired.
4. Remove `SUPABASE_SERVICE_ROLE_KEY` from `.env` after the command succeeds.
5. Sign in through `/login`. A successful admin login opens `/admin`; ordinary
   accounts are routed to their regular profile.

If the command reports an interrupted provisioning response, do not rerun it
blindly: it deliberately keeps the generated Auth account because the database
transaction may already have succeeded. Use the printed credentials to check
`/login` or inspect the project in Supabase first.

To use a company-controlled address or a password selected in a password
manager, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` only for that one command. The
password must be at least 12 characters.

## Verification checklist

- An anonymous visitor and a normal signed-in user receive no admin data.
- An admin-role profile whose email is removed from the allowlist receives no
  admin data or contest-admin privileges.
- The provisioned, confirmed account can list users, change roles/statuses,
  manage contests, and send announcements.
- The admin allowlist contains only the provisioned email, and no other active
  profile has `role = 'admin'`.
- The `admin_emails` table cannot be read directly from browser roles.
- A normal account cannot delete/recreate its profile to choose a role, mint a
  certificate, fabricate activity, or create a platform notification.
- A judge can create and run only unrated contests; a confirmed admin creates,
  manages, and finalizes rated contests, and admins/organizers cannot enter
  them as rated participants.
