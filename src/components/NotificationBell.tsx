import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { Link, useRouter } from '@/router';
import { formatTimeAgo, useNotifications, type UiNotification } from '@/lib/notifications';
import { LoadingState } from '@/components/LoadingState';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications: localNotifications, loading, error, markAsRead, markAllAsRead } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  const unreadCount = localNotifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const handleClick = (n: UiNotification) => {
    void markAsRead(n.id);
    if (n.action_link) {
      setOpen(false);
      navigate(n.action_link);
    }
  };

  return (
    <div className="notification-bell relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-error-500 to-error-600 px-1 text-[10px] font-extrabold text-white shadow-soft ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-slate-200/60">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="chip bg-error-500/10 text-error-600 text-[10px]">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllAsRead()}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <LoadingState className="min-h-[12rem] rounded-none" message="Bildirishnomalar yuklanmoqda" />
            ) : error ? (
              <div className="p-8 text-center text-sm text-error-600">Unable to load notifications. Please try again.</div>
            ) : localNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              localNotifications.slice(0, 8).map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`group flex w-full items-start gap-3 border-0 border-b border-slate-50 bg-transparent p-4 text-left transition-colors hover:bg-slate-50/60 ${
                      !n.read ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${n.color} shadow-soft`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">{n.title}</p>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.message}</p>

                      {/* Meta for rating changes */}
                      {typeof n.meta.ratingDelta === 'number' && (
                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                          <span className="font-bold tabular-nums text-slate-500">{n.meta.ratingBefore}</span>
                          <span className={`flex items-center font-bold ${n.meta.ratingDelta > 0 ? 'text-success-600' : 'text-error-600'}`}>
                            {n.meta.ratingDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {n.meta.ratingDelta > 0 ? '+' : ''}{n.meta.ratingDelta}
                          </span>
                          <span className="font-bold tabular-nums text-slate-700">{n.meta.ratingAfter}</span>
                        </div>
                      )}

                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{formatTimeAgo(n.created_at)}</span>
                        {n.action_label && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 group-hover:text-indigo-700">
                            {n.action_label}
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 bg-slate-50/50 py-3 text-center text-xs font-bold text-indigo-600 transition-colors hover:bg-slate-100 hover:text-indigo-700"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

/* ============ Full Notification Center Page ============ */

export function NotificationCenterPage() {
  const { notifications: localNotifications, loading, error, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? localNotifications
    : filter === 'unread'
    ? localNotifications.filter((n) => !n.read)
    : localNotifications.filter((n) => n.type === filter);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'contest-reminder', label: 'Contest Reminders' },
    { key: 'rating-change', label: 'Rating Changes' },
    { key: 'submission-result', label: 'Submissions' },
    { key: 'achievement-unlocked', label: 'Achievements' },
    { key: 'new-contest', label: 'New Contests' },
    { key: 'announcement', label: 'Announcements' },
  ];

  return (
    <div className="container-page py-10">
      <div className="flex items-center justify-between">
        <div>
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-electric-500" />
            Inbox
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Notifications
          </h1>
        </div>
        <button
          onClick={() => void markAllAsRead()}
          className="btn-ghost px-4 py-2.5 text-sm"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-2xl px-3.5 py-2 text-xs font-bold transition-all ${
              filter === f.key
                ? 'bg-gradient-to-r from-indigo-500 to-electric-500 text-white shadow-soft'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <LoadingState className="card" message="Bildirishnomalar yuklanmoqda" />
        ) : error ? (
          <div className="card p-12 text-center text-sm font-semibold text-error-600">Unable to load notifications. Please try again.</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-400">No notifications in this category</p>
          </div>
        ) : (
          filtered.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-4 p-5 transition-all hover:shadow-soft ${
                  !n.read ? 'ring-2 ring-indigo-200/50' : ''
                }`}
              >
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${n.color} shadow-soft`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{n.title}</p>
                    <span className="flex-shrink-0 text-xs text-slate-400">{formatTimeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{n.message}</p>

                  {n.meta?.ratingDelta !== undefined && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="font-bold tabular-nums text-slate-500">{n.meta.ratingBefore}</span>
                      <span className={`flex items-center font-bold ${n.meta.ratingDelta > 0 ? 'text-success-600' : 'text-error-600'}`}>
                        {n.meta.ratingDelta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {n.meta.ratingDelta > 0 ? '+' : ''}{n.meta.ratingDelta}
                      </span>
                      <span className="font-bold tabular-nums text-slate-700">{n.meta.ratingAfter}</span>
                      {n.meta.subject && <span className="text-xs text-slate-400">· {n.meta.subject}</span>}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    {n.action_label && n.action_link && (
                      <Link
                        to={n.action_link}
                        onClick={() => void markAsRead(n.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                      >
                        {n.action_label}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {!n.read && (
                      <button
                        onClick={() => void markAsRead(n.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                      >
                        <Check className="h-3 w-3" />
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
                {!n.read && (
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-500 ring-2 ring-indigo-100" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
