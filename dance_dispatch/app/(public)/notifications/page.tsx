'use client';

import Link from 'next/link';
import { Bell, CheckCheck, Circle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/app/providers/AuthContext';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  href: string;
  isRead: boolean;
};

function formatRelativeTime(dateValue: string): string {
  const ts = Date.parse(dateValue);
  if (Number.isNaN(ts)) return 'Just now';

  const diffMs = Date.now() - ts;
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationsPage() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!session?.user?.id) {
      setNotifications([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await fetch('/api/notifications?limit=100', { cache: 'no-store' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to load notifications.' }));
        setNotifications([]);
        setLoadError(typeof payload?.error === 'string' ? payload.error : 'Failed to load notifications.');
        return;
      }

      const data = (await res.json()) as NotificationItem[];
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
      setLoadError('Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    const channel = supabase
      .channel('notifications-feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, session?.user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const visibleNotifications = useMemo(
    () => (showUnreadOnly ? notifications.filter((item) => !item.isRead) : notifications),
    [notifications, showUnreadOnly]
  );

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );

    await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    }).catch(() => {
      // Keep optimistic state; realtime fetch will eventually correct it if needed.
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) {
      return;
    }

    setIsUpdating(true);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true, isRead: true }),
      });
    } finally {
      setIsUpdating(false);
    }
  }, [unreadCount]);

  return (
    <section className="mx-auto max-w-3xl rounded-xl border border-default bg-surface p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-text" />
          <h1 className="text-2xl font-bold text-text">Notifications</h1>
        </div>

        <button
          type="button"
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0 || isUpdating}
          className="inline-flex items-center gap-2 rounded-md border border-default px-3 py-1.5 text-xs font-medium text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Mark all read
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowUnreadOnly(false)}
          className={`rounded-full px-3 py-1 ${!showUnreadOnly ? 'bg-text text-bg' : 'bg-bg text-text'}`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setShowUnreadOnly(true)}
          className={`rounded-full px-3 py-1 ${showUnreadOnly ? 'bg-text text-bg' : 'bg-bg text-text'}`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading notifications...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : visibleNotifications.length === 0 ? (
        <p className="text-sm text-muted">
          {showUnreadOnly ? 'You are all caught up.' : 'No notifications yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibleNotifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-lg border border-default p-4 ${notification.isRead ? 'opacity-80' : 'bg-bg/40'}`}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-text">{notification.title}</h2>
                <span className="text-xs text-muted">{formatRelativeTime(notification.createdAt)}</span>
              </div>

              <p className="mb-3 text-sm text-muted">{notification.description}</p>

              <div className="flex items-center justify-between">
                <Link
                  href={notification.href}
                  className="text-sm font-medium hover:underline"
                  onClick={() => {
                    if (!notification.isRead) {
                      void markAsRead(notification.id);
                    }
                  }}
                >
                  Open
                </Link>

                {!notification.isRead ? (
                  <button
                    type="button"
                    onClick={() => void markAsRead(notification.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
                  >
                    <Circle className="h-3 w-3 fill-current" />
                    Mark as read
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
