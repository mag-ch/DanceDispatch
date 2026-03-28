'use client';
import { useAuth } from '@/app/providers/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getUsernameFromId } from '@/lib/utils_supabase';
import { ThemeToggle } from './ThemeProvider';
import { Bell, X } from 'lucide-react';
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

export function Header() {
    const { session, loading, logout } = useAuth();
    const router = useRouter();
    const [username, setUsername] = useState<string | null>(null);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications?limit=8', { cache: 'no-store' });
            if (!res.ok) return;

            const data = (await res.json()) as NotificationItem[];
            setNotifications(Array.isArray(data) ? data : []);
        } catch {
            setNotifications([]);
        }
    }, []);

    useEffect(() => {
        const user = session?.user;
        if (!user) {
            setUsername(null);
            return;
        }

        const metadataUsername =
            (typeof user.user_metadata?.username === 'string' && user.user_metadata.username.trim()) ||
            (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
            null;

        if (metadataUsername) {
            setUsername(metadataUsername);
        }

        getUsernameFromId(user.id).then((fetchedUsername) => {
            if (fetchedUsername && fetchedUsername.trim().length > 0) {
                setUsername(fetchedUsername);
            }
        });
    }, [session?.user]);

    useEffect(() => {
        if (!session?.user?.id) {
            setNotifications([]);
            return;
        }

        loadNotifications();

        const topic = `notifications-header:${session.user.id}`;
        
        const channel = supabase.channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'INSERT' }, (payload) => {
            void loadNotifications();
          })
          .subscribe();
        return () => {
          void supabase.removeChannel(channel);
        };
    }, [loadNotifications, session?.user?.id]);

    const handleLogout = async () => {
        await logout();
        router.push('/auth/login');
    };

    const handleNotificationClick = () => {
        loadNotifications();

        if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
            setIsNotificationModalOpen(true);
            return;
        }

        router.push('/notifications');
    };

    useEffect(() => {
        if (!isNotificationModalOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsNotificationModalOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isNotificationModalOpen]);

    if (loading) {
        return (
            <header className="bg-bg site-header border-b border-border">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <Link href="/" className="text-2xl text-text font-bold">DanceDispatch</Link>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <>
            <header className="bg-bg dark:bg-surface site-header shadow-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <Link href="/" className="text-2xl text-text font-bold">DanceDispatch</Link>
                        <nav className="flex items-center text-muted gap-4">
                            <ThemeToggle />
                            <Link href="/search" className="hover:underline">Search</Link>
                            {session ? (
                                <>
                                    <Link href="/profile" className="hover:underline">{username}</Link>
                                    <button
                                        type="button"
                                        onClick={handleNotificationClick}
                                        className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                        aria-label="Open notifications"
                                    >
                                        <Bell className="h-5 w-5" />
                                        {/* {notifications.length > 0 && (
                                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                                        )} */}
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href="/auth/login"
                                        className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/auth/signup"
                                        className="btn-highlighted px-4 py-2 rounded-lg transition"
                                    >
                                        Sign Up
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            </header>

            {isNotificationModalOpen && (
                <div
                    className="fixed inset-0 z-[60] hidden md:flex items-start justify-end bg-black/35 px-4 py-20"
                    onClick={() => setIsNotificationModalOpen(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-xl border border-default bg-surface p-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Notifications"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-text">Notifications</h2>
                            <button
                                type="button"
                                onClick={() => setIsNotificationModalOpen(false)}
                                className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                                aria-label="Close notifications"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {notifications.length === 0 ? (
                                <li className="rounded-lg border border-default px-3 py-2">
                                    <p className="text-sm text-muted">No notifications yet.</p>
                                </li>
                            ) : (
                                notifications.map((notification) => (
                                    <li key={notification.id} className="rounded-lg border border-default px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsNotificationModalOpen(false);
                                                router.push(notification.href);
                                            }}
                                            className="w-full text-left"
                                        >
                                            <p className="text-sm font-medium text-text">{notification.title}</p>
                                            <p className="text-xs text-muted">{formatRelativeTime(notification.createdAt)}</p>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                        <button
                            type="button"
                            onClick={() => {
                                setIsNotificationModalOpen(false);
                                router.push('/notifications');
                            }}
                            className="mt-4 w-full rounded-md border border-default px-3 py-2 text-sm font-semibold text-text hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Open full feed
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
