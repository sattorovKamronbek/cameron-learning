import { useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';
import { AuthContext } from './auth-context';

function mapAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('Email not confirmed')) return 'Email tasdiqlash hali Supabase loyihasida yoqilgan. Dashboard’dan Confirm email sozlamasini o‘chiring.';
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  return message;
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

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setProfile(await readProfile(userId));
    } catch (error) {
      console.error('Failed to fetch profile:', error instanceof Error ? error.message : error);
      setProfile(null);
    }
  }, [readProfile]);

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: mapAuthError(error.message) };

    // Supabase Auth authenticates the credential, while the application owns
    // account status. Refuse suspended or banned accounts before routing them
    // into any signed-in experience.
    try {
      const signedInProfile = data.user ? await readProfile(data.user.id) : null;
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
      await supabase.auth.signOut();
      return { error: profileError instanceof Error ? profileError.message : 'Account profile could not be verified.' };
    }

    return { error: null };
  }, [readProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) return { error: mapAuthError(error.message) };

    // With Confirm email disabled, Supabase returns a session immediately.
    // Keeping this guard makes a project-level misconfiguration clear instead
    // of showing an unusable signed-out profile page.
    if (!data.session?.user) {
      return {
        error: 'Hisob yaratildi, ammo Supabase’da Confirm email hali yoqilgan. Uni o‘chirib, keyin sign in qiling.',
      };
    }

    await fetchProfile(data.session.user.id);
    return { error: null };
  }, [fetchProfile]);

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
      value={{ session, user, profile, loading, signIn, signUp, signOut, updateProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
