import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generatedEmail() {
  return `admin-${randomBytes(10).toString('hex')}@cameron.local`;
}

function generatedPassword() {
  // Base64url is URL-safe; the prefix guarantees mixed character classes for
  // stricter Supabase password policies without writing the secret to disk.
  return `Ca!${randomBytes(28).toString('base64url')}9z`;
}

function required(name, value) {
  if (!value) {
    throw new Error(`${name} is required. Add it temporarily to .env, then run this command again.`);
  }
  return value;
}

class ProvisioningRpcError extends Error {
  constructor(message, cleanupIsSafe) {
    super(message);
    this.cleanupIsSafe = cleanupIsSafe;
  }
}

try {
  const url = required('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  const email = (process.env.ADMIN_EMAIL?.trim().toLowerCase() || generatedEmail());
  const password = process.env.ADMIN_PASSWORD || generatedPassword();

  if (!emailPattern.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Platform Administrator' },
  });

  if (createError || !created.user) {
    throw new Error(`Administrator account was not created: ${createError?.message ?? 'no user returned'}`);
  }

  try {
    // This server-only RPC is transactional: it adds the new account, removes
    // every prior allowlist entry, and demotes prior admin profiles together.
    // Direct table writes are deliberately not part of the provisioning path.
    const { data: provisioned, error: provisionError } = await supabase.rpc('provision_exclusive_admin', {
      p_target_user_id: created.user.id,
    });
    if (provisionError) {
      const migrationMissing = provisionError.code === 'PGRST202'
        && provisionError.message.includes('provision_exclusive_admin');
      // A PostgREST error with a database/API code confirms the transaction
      // failed and cleanup is safe. A transport error may have arrived after a
      // successful commit, so deleting this user could remove the sole admin.
      throw new ProvisioningRpcError(
        migrationMissing
          ? 'Administrator setup function is missing from the Supabase project. Deploy the repository migrations with `npx supabase@latest db push`, then run this command again.'
          : `Exclusive administrator setup failed: ${provisionError.message}`,
        Boolean(provisionError.code),
      );
    }

    const details = provisioned && typeof provisioned === 'object' ? provisioned : {};
    const demoted = Number(details.demoted_admin_profiles ?? 0);
    const replaced = Number(details.replaced_allowlist_entries ?? 0);

    console.log(`Previous admin profiles demoted: ${demoted}`);
    console.log(`Previous allowlist entries replaced: ${replaced}`);
  } catch (error) {
    if (error instanceof ProvisioningRpcError && !error.cleanupIsSafe) {
      // Keep the account intact on an ambiguous transport failure. The RPC is
      // transactional, but its response might have been lost after commit.
      console.error('The provisioning response was interrupted. The new Auth user was intentionally kept so a possibly successful sole admin is not deleted.');
      console.error(`User ID: ${created.user.id}`);
      console.error(`Email: ${email}`);
      console.error(`Password: ${password}`);
      console.error('Check the protected admin dashboard or Supabase Auth before attempting any recovery.');
    } else {
      // A confirmed server-side rejection cannot have committed the transaction,
      // so remove the unused Auth credential rather than leaving a partial user.
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    }
    throw error;
  }

  console.log('The sole administrator account was created successfully. Store these credentials in a password manager now:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log('The service-role key is never needed by the browser; remove it from .env after this one-time setup.');
} catch (error) {
  console.error(`Administrator provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
