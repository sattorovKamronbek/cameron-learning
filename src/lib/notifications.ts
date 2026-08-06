import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Award, Bell, Calendar, CheckCircle2, Clock, Flame, Megaphone, Trophy, TrendingUp, type LucideIcon } from 'lucide-react';
import { supabase, type AppNotification } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type UiNotification = Omit<AppNotification, 'metadata'> & {
  icon: LucideIcon;
  color: string;
  meta: Record<string, unknown> & { ratingBefore?: number; ratingAfter?: number; ratingDelta?: number; subject?: string };
};

const presentation: Record<string, Pick<UiNotification, 'icon' | 'color'>> = {
  'contest-reminder': { icon: Clock, color: 'from-indigo-500 to-indigo-700' },
  'rating-change': { icon: TrendingUp, color: 'from-success-500 to-electric-600' },
  'submission-result': { icon: CheckCircle2, color: 'from-success-500 to-success-700' },
  'achievement-unlocked': { icon: Trophy, color: 'from-sun-400 to-sun-600' },
  'new-contest': { icon: Calendar, color: 'from-electric-500 to-indigo-600' },
  announcement: { icon: Megaphone, color: 'from-purple-500 to-pink-600' },
  'weekly-summary': { icon: Flame, color: 'from-error-500 to-orange-600' },
};

function present(notification: AppNotification): UiNotification {
  return { ...notification, ...(presentation[notification.type] ?? { icon: Bell, color: 'from-slate-500 to-slate-700' }), meta: notification.metadata ?? {} };
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setNotifications([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (queryError) setError(queryError.message);
    else { setNotifications((data as AppNotification[]).map(present)); setError(null); }
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
    const { error: updateError } = await supabase.from('app_notifications').update({ read: true }).eq('id', id);
    if (updateError) { setError(updateError.message); void refresh(); }
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    const { error: updateError } = await supabase.from('app_notifications').update({ read: true }).eq('read', false);
    if (updateError) { setError(updateError.message); void refresh(); }
  }, [refresh]);

  return { notifications, loading, error, refresh, markAsRead, markAllAsRead };
}
