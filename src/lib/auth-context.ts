import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabase';

export type AuthActionResult = {
  error: string | null;
  requiresEmailConfirmation?: boolean;
  message?: string;
};

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthActionResult>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
