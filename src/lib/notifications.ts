import { useCallback, useEffect, useState } from 'react';
import { Bell, Calendar, CheckCircle2, Clock, Flame, Megaphone, Trophy, TrendingUp, type LucideIcon } from 'lucide-react';
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

/** Formats timestamps returned by the notification table for the UI. */
export function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const elapsed = Date.now() - date.getTime();

  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Just now';

  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
