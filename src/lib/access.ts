import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { checkAdminAccess } from '@/lib/security';

/**
 * Mirrors the server's two paths into contest management: active judges may
 * manage only their own contests, while an administrator also needs the full
 * confirmed-email + allowlist grant. The RPCs still enforce this independently.
 */
export function useAccessControl() {
  const { user, profile, loading: authLoading } = useAuth();
  const [adminAccess, setAdminAccess] = useState<boolean | null>(null);
  const needsAdminCheck = Boolean(
    user
      && profile
      && profile.status === 'active'
      && profile.role === 'admin',
  );

  useEffect(() => {
    let active = true;

    if (!needsAdminCheck) {
      setAdminAccess(false);
      return () => { active = false; };
    }

    setAdminAccess(null);
    void checkAdminAccess()
      .then((allowed) => {
        if (active) setAdminAccess(allowed);
      })
      .catch(() => {
        if (active) setAdminAccess(false);
      });

    return () => { active = false; };
  }, [needsAdminCheck, profile?.id, user?.id]);

  // Do not retain a previous successful admin check for even one render after
  // the profile role/status changes. The database remains authoritative, but
  // this keeps privileged navigation and route gates in step with it.
  const hasVerifiedAdminAccess = needsAdminCheck && adminAccess === true;
  const canManageContests = Boolean(
    profile
      && profile.status === 'active'
      && (
        profile.role === 'judge'
        || (profile.role === 'admin' && hasVerifiedAdminAccess)
      ),
  );

  return {
    adminAccess: hasVerifiedAdminAccess,
    canManageContests,
    loading: authLoading || (needsAdminCheck && adminAccess === null),
  };
}
