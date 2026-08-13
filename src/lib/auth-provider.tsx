import { useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';
import { AuthContext } from './auth-context';

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return 'Email yoki parol noto‘g‘ri. Iltimos, qayta tekshirib ko‘ring.';
  }
  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')) {
    return 'Email hali tasdiqlanmagan. Tasdiqlash xatini oching yoki xatni qayta yuboring.';
  }
  if (normalized.includes('refresh token') || normalized.includes('session not found')) {
    return 'Bu qurilmadagi eski sessiya yangilandi. Email va parol bilan yana kiring.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Juda ko‘p urinish bo‘ldi. Bir necha daqiqadan keyin qayta urinib ko‘ring.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('load failed')) {
    return 'Serverga ulanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';
  }
  if (normalized.includes('user already registered')) return 'Bu email bilan hisob allaqachon mavjud. Tizimga kiring.';
  if (normalized.includes('password should be at least')) return 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.';
  return message;
}

function mapUnknownAuthError(error: unknown): string {
  return mapAuthError(error instanceof Error ? error.message : 'Serverga ulanib bo‘lmadi. Qayta urinib ko‘ring.');
}

function needsEmailConfirmation(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed');
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const readProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (data) return data as Profile;

    // New accounts are normally created by the Auth trigger. This secure
    // recovery RPC only handles legacy accounts that genuinely lack a profile;
    // it never accepts browser-supplied role, status, plan, or email values.
    const { error: ensureError } = await supabase.rpc('ensure_my_profile');
    if (ensureError) throw new Error(ensureError.message);

    const { data: restored, error: restoredError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (restoredError) throw new Error(restoredError.message);
    return restored as Profile | null;
  }, []);

  const readProfileWithRetry = useCallback(async (userId: string): Promise<Profile | null> => {
    let lastError: unknown;

    // The Auth trigger and the browser session are created independently. On a
    // new device, wait briefly for a just-created profile instead of treating a
    // short database propagation delay as a failed login.
    for (const delay of [0, 200, 500]) {
      if (delay) await pause(delay);
      try {
        const profile = await readProfile(userId);
        if (profile) return profile;
        lastError = new Error('Profile has not been created yet.');
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Profile could not be loaded.');
  }, [readProfile]);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setProfile(await readProfileWithRetry(userId));
    } catch (error) {
      console.error('Failed to fetch profile:', error instanceof Error ? error.message : error);
      setProfile(null);
    }
  }, [readProfileWithRetry]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        (async () => {
          await fetchProfile(newSession.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  useEffect(() => {
    // A status change made in the admin console takes effect for already-open
    // sessions as soon as their profile refreshes, not only on the next login.
    if (user && profile && profile.status !== 'active') {
      void supabase.auth.signOut();
    }
  }, [profile, user]);

  useEffect(() => {
    if (!user) return undefined;

    // RLS rejects mutations from a non-active account immediately. Refreshing
    // on focus and at a modest interval also clears a stale browser session
    // promptly after an admin suspends or bans the account.
    const refreshStatus = () => { void fetchProfile(user.id); };
    const intervalId = window.setInterval(refreshStatus, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshStatus();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchProfile, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    // A corrupt or expired refresh token must never prevent a password login.
    // Local scope clears this browser only; it does not sign the learner out on
    // their other devices.
    try {
      const { error: clearSessionError } = await supabase.auth.signOut({ scope: 'local' });
      if (clearSessionError) {
        console.warn('Could not clear the previous local auth session:', clearSessionError.message);
      }
    } catch (clearSessionError) {
      // A password sign-in can still replace the session, so do not let a
      // best-effort cleanup request block the learner from logging in.
      console.warn('Could not clear the previous local auth session:', clearSessionError);
    }

    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'];
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      }));
    } catch (signInError) {
      return { error: mapUnknownAuthError(signInError) };
    }
    if (error) {
      return {
        error: mapAuthError(error.message),
        requiresEmailConfirmation: needsEmailConfirmation(error.message),
      };
    }

    // Supabase Auth authenticates the credential, while the application owns
    // account status. Refuse suspended or banned accounts before routing them
    // into any signed-in experience.
    try {
      const signedInProfile = data.user ? await readProfileWithRetry(data.user.id) : null;
      if (!signedInProfile) {
        await supabase.auth.signOut();
        return { error: 'Account profile could not be loaded. Please contact support.' };
      }
      if (signedInProfile.status !== 'active') {
        await supabase.auth.signOut();
        return {
          error: signedInProfile.status === 'suspended'
            ? `This account is suspended${signedInProfile.suspended_reason ? `: ${signedInProfile.suspended_reason}` : '.'}`
            : 'This account has been banned.',
        };
      }
    } catch (profileError) {
      // Credentials have already been verified by Supabase. Do not discard a
      // valid session merely because a profile read has a transient failure;
      // protected database operations still enforce the account status server
      // side, and the provider retries the profile load in the background.
      console.error('Signed in, but profile verification is temporarily unavailable:', profileError);
      if (data.user) void fetchProfile(data.user.id);
    }

    return { error: null };
  }, [fetchProfile, readProfileWithRetry]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    let data: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'];
    let error: Awaited<ReturnType<typeof supabase.auth.signUp>>['error'];
    try {
      ({ data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName },
        },
      }));
    } catch (signUpError) {
      return { error: mapUnknownAuthError(signUpError) };
    }
    if (error) return { error: mapAuthError(error.message) };

    // With Confirm email disabled, Supabase returns a session immediately.
    // Keeping this guard makes a project-level misconfiguration clear instead
    // of showing an unusable signed-out profile page.
    if (!data.session?.user) {
      return {
        error: null,
        requiresEmailConfirmation: true,
        message: 'Hisob yaratildi. Davom etish uchun emailingizga kelgan tasdiqlash xatini oching.',
      };
    }

    await fetchProfile(data.session.user.id);
    return { error: null };
  }, [fetchProfile]);

  const resendConfirmation = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      return { error: error ? mapAuthError(error.message) : null };
    } catch (resendError) {
      return { error: mapUnknownAuthError(resendError) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => {
      if (!user) return { error: 'Not authenticated' };
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) return { error: error.message };
      await fetchProfile(user.id);
      return { error: null };
    },
    [user, fetchProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, signIn, signUp, resendConfirmation, signOut, updateProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
