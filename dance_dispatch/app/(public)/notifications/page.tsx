'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  href: string;
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

export default function NotificationsFeedPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=50', { cache: 'no-store' });
      if (!res.ok) {
        setNotifications([]);
        return;
      }

      const data = (await res.json()) as NotificationItem[];
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();

    const channel = supabase
      .channel('notifications-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Events' },
        () => {
          void loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'SavedEvents' },
        () => {
          void loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Reviews' },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  return (
    <section className="mx-auto max-w-3xl rounded-xl border border-default bg-surface p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <Bell className="h-6 w-6 text-text" />
        <h1 className="text-2xl font-bold text-text">Notifications</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted">No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification.id} className="rounded-lg border border-default p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-text">{notification.title}</h2>
                <span className="text-xs text-muted">{formatRelativeTime(notification.createdAt)}</span>
              </div>
              <p className="mb-2 text-sm text-muted">{notification.description}</p>
              <Link href={notification.href} className="text-sm font-medium hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
