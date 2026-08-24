'use client';
import { useAuth } from '@/app/providers/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getUsernameFromId } from '@/lib/utils_supabase';
import { ThemeToggle } from './ThemeProvider';
import { Bell, MapPin, Menu, MessageSquarePlus, Plus, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { SubmitEventButton } from './SubmitEvent/SubmitEventButton';

type NotificationItem = {
    id: string;
    type: string;
    title: string;
    description: string;
    createdAt: string;
    href: string;
    isRead: boolean;
};

type FeedbackItem = {
    id: string;
    content: string;
    createdAt: string;
    status?: string | null;
};

const CITY_OPTIONS = ['Brooklyn, NY', 'Manhattan, NY', 'Queens, NY', 'Los Angeles, CA', 'Chicago, IL'];

function CityPicker() {
    const [city, setCity] = useState(CITY_OPTIONS[0]);

    useEffect(() => {
        const savedCity = window.localStorage.getItem('dance-dispatch-city');
        if (savedCity && CITY_OPTIONS.includes(savedCity)) {
            setCity(savedCity);
        }
    }, []);

    return (
        <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm text-muted transition hover:border-accent-2 hover:text-text">
            <MapPin className="h-4 w-4 text-accent-2" />
            <span className="sr-only">Choose your city</span>
            <select
                aria-label="Choose your city"
                value={city}
                onChange={(event) => {
                    setCity(event.target.value);
                    window.localStorage.setItem('dance-dispatch-city', event.target.value);
                }}
                className="max-w-[8.5rem] cursor-pointer appearance-none bg-transparent font-medium text-text outline-none"
            >
                {CITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
        </label>
    );
}

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
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState<string | null>(null);
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isNotificationUpdating, setIsNotificationUpdating] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackDraft, setFeedbackDraft] = useState('');
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);
 useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);
    const resolveNotificationHref = useCallback((href: string) => {
        if (!href.startsWith('?')) {
            return href;
        }

        const params = new URLSearchParams(searchParams?.toString() ?? '');
        const nextParams = new URLSearchParams(href.slice(1));

        nextParams.forEach((value, key) => {
            params.set(key, value);
        });

        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
    }, [pathname, searchParams]);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications?limit=8', { cache: 'no-store' });
            if (!res.ok) {
                setNotifications([]);
                return;
            }

            const data = (await res.json()) as NotificationItem[];
            setNotifications(Array.isArray(data) ? data : []);
        } catch {
            setNotifications([]);
        }
    }, []);

    const loadFeedback = useCallback(async () => {
        setIsFeedbackLoading(true);
        setFeedbackError(null);

        try {
            const res = await fetch('/api/feedback?limit=20', { cache: 'no-store' });
            if (!res.ok) {
                setFeedbackItems([]);
                setFeedbackError('Unable to load feedback history right now.');
                return;
            }

            const data = (await res.json()) as FeedbackItem[];
            setFeedbackItems(Array.isArray(data) ? data : []);
        } catch {
            setFeedbackItems([]);
            setFeedbackError('Unable to load feedback history right now.');
        } finally {
            setIsFeedbackLoading(false);
        }
    }, []);

    useEffect(() => {
        const user = session?.user;
        if (!user) {
            setUsername(null);
            setProfilePicture(null);
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

        supabase
            .from('profiles')
            .select('profile_picture')
            .eq('id', user.id)
            .maybeSingle()
            .then(({ data }: { data: { profile_picture?: unknown } | null }) => {
                setProfilePicture(typeof data?.profile_picture === 'string' ? data.profile_picture : null);
            });
    }, [session?.user]);

    useEffect(() => {
        if (!session?.user?.id) {
            setNotifications([]);
            return;
        }

        loadNotifications();

                const channel = supabase.channel(`notifications-header:${session.user.id}`)
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

    const unreadCount = notifications.filter((notification) => !notification.isRead).length;

    const markNotificationAsRead = useCallback(async (notificationId: string) => {
        setNotifications((current) =>
            current.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
        );

        await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRead: true }),
        }).catch(() => {
            // Keep optimistic state; realtime refresh will reconcile if needed.
        });
    }, []);

    const markAllNotificationsAsRead = useCallback(async () => {
        if (unreadCount === 0) {
            return;
        }

        setIsNotificationUpdating(true);
        setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true, isRead: true }),
            });
        } finally {
            setIsNotificationUpdating(false);
        }
    }, [unreadCount]);

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

    const handleFeedbackClick = () => {
        setIsFeedbackModalOpen(true);
        void loadFeedback();
    };

    const handleFeedbackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const content = feedbackDraft.trim();
        if (!content) {
            setFeedbackError('Please enter your feedback before submitting.');
            return;
        }

        setIsSubmittingFeedback(true);
        setFeedbackError(null);

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (!res.ok) {
                const errorPayload = await res.json().catch(() => ({ error: 'Failed to submit feedback.' }));
                setFeedbackError(typeof errorPayload?.error === 'string' ? errorPayload.error : 'Failed to submit feedback.');
                return;
            }

            setFeedbackDraft('');
            await loadFeedback();
        } catch {
            setFeedbackError('Failed to submit feedback.');
        } finally {
            setIsSubmittingFeedback(false);
        }
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

    useEffect(() => {
        if (!isFeedbackModalOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsFeedbackModalOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isFeedbackModalOpen]);

    if (loading || !isHydrated) {
        return (
            <header className="site-header border-b border-border bg-[#0b0912] text-white">
                <div className="container mx-auto flex h-16 items-center px-4">
                    <Link href="/" className="text-xl font-black uppercase tracking-tight">Dance<span className="text-fuchsia-400">Dispatch</span></Link>
                </div>
            </header>
        );
    }

    return (
        <>
            <header className="site-header sticky top-0 z-50 border-b border-white/5 bg-bg text-white shadow-lg">
                <div className="container mx-auto flex min-h-16 items-center gap-6 px-3 sm:px-4">
                    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-xl font-bold tracking-tight hover:underline hover:underline-offset-4 sm:text-2xl">
                        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full" aria-label="DanceDispatch logo">
                            <img src="/icons/icon_1.png" alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="hidden text-text md:inline">Dance<span className="bg-gradient-to-r from-fuchsia-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">Dispatch</span></span>
                    </Link>
                    <nav className="hidden items-center gap-1 text-sm text-text/60 md:flex">
                        <Link href="/" className="px-4 py-2 transition ">Home</Link>
                        <Link href="/mission" className="px-4 py-2 transition ">Mission</Link>
                        <Link href="/party-calendar" className="px-4 py-2 transition">Calendar</Link>
                     <SubmitEventButton
                            label="Add event"
                            className="hidden items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
                        />
                    </nav>
                    <nav className="ml-auto flex items-center gap-2 text-white/70">
                        <CityPicker />
                        <Link href="/search" className="rounded-full p-2 transition hover:bg-white/10 hover:text-white" aria-label="Search">
                            <Search className="h-5 w-5" />
                        </Link>
                        {session && (
                            <>
                                <button type="button" onClick={handleNotificationClick} className="relative rounded-full p-2 transition hover:bg-white/10 hover:text-white" aria-label="Open notifications">
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-fuchsia-400" />}
                                </button>
                                <button type="button" onClick={handleFeedbackClick} className="hidden rounded-full p-2 transition hover:bg-white/10 hover:text-white md:block" aria-label="Send feedback">
                                    <MessageSquarePlus className="h-5 w-5" />
                                </button>
                                <span className="hidden md:inline-flex">
                                    <ThemeToggle />
                                </span>
                                <Link href='/profile' className="hidden items-center gap-2 rounded-full border border-white/10 pl-1 pr-3 transition hover:border-white/25 md:flex" aria-label="Open profile">
                                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-sm font-bold text-[#191323]">
                                        {profilePicture ? <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePicture})` }} /> : (username?.[0] ?? 'D').toUpperCase()}
                                    </span>
                                    <span className=" max-w-20 truncate text-sm font-semibold text-text">{username ?? 'Profile'}</span>
                                </Link>
                            </>
                        )}
                       
                    
                        {!session && (
                            <>
                            <Link href="/auth/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-white/10 md:block">Log in</Link>
                            <Link href="/auth/signup" className="hidden rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 md:block">Sign up</Link>
                            </>
                        )}
                        {session && (
                            <Link href="/profile" className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-sm font-bold text-[#191323] md:hidden" aria-label="Open profile">
                                {profilePicture ? <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePicture})` }} /> : (username?.[0] ?? 'D').toUpperCase()}
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                            className="rounded-full p-2 transition hover:bg-white/10 md:hidden"
                            aria-label="Open menu"
                            aria-expanded={isMobileMenuOpen}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    </nav>
                </div>

            {isMobileMenuOpen && (
                <div className="border-t border-white/5 bg-[#0b0912] md:hidden">
                    <nav className="flex flex-col px-4 py-3">
                        <Link
                            href="/search"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                        >
                            Search
                        </Link>
                        <Link
                            href="/party-calendar"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                        >
                            Party Calendar
                        </Link>
                        <Link
                            href="/mission"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                        >
                            Mission
                        </Link>
                        <SubmitEventButton
                            label="Add event"
                            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-white/80 hover:bg-white/10"
                        />
                        {session ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { setIsMobileMenuOpen(false); handleFeedbackClick(); }}
                                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-white/80 hover:bg-white/10"
                                >
                                    Feedback
                                </button>
                                <Link href='/profile' onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10" aria-label="Open profile">
                                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-sm font-bold text-[#191323]">
                                        {profilePicture ? <span className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePicture})` }} /> : (username?.[0] ?? 'D').toUpperCase()}
                                    </span>
                                    <span className="max-w-20 truncate">{username ?? 'Profile'}</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                                    className="rounded-md px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-white/10"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="rounded-md px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/signup"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="btn-highlighted rounded-md px-3 py-2.5 text-sm font-semibold"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            )}
            </header>

            {isNotificationModalOpen && (
                <div
                    className="fixed inset-0 z-[60] hidden md:flex items-start justify-end bg-black/35 px-4 py-20"
                    onClick={() => setIsNotificationModalOpen(false)}
                >
                    <div
                        className="w-full max-w-[75vw] max-h-[75vh] rounded-xl border border-default bg-surface p-4 shadow-2xl flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Notifications"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-text">Notifications</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={unreadCount === 0 || isNotificationUpdating}
                                    onClick={() => {
                                        void markAllNotificationsAsRead();
                                    }}
                                    className="rounded-md border border-default px-2 py-1 text-xs font-medium text-text hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700"
                                >
                                    {isNotificationUpdating ? 'Updating...' : 'Mark all read'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsNotificationModalOpen(false)}
                                    className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    aria-label="Close notifications"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        <ul className="space-y-2 overflow-y-auto pr-1">
                            {notifications.length === 0 ? (
                                <li className="rounded-lg border border-default px-3 py-2">
                                    <p className="text-sm text-muted">No notifications yet.</p>
                                </li>
                            ) : (
                                notifications.map((notification) => (
                                    <li key={notification.id} className={`rounded-lg border border-default px-3 py-2 ${notification.isRead ? 'opacity-80' : 'bg-bg/40'}`}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!notification.isRead) {
                                                    void markNotificationAsRead(notification.id);
                                                }
                                                setIsNotificationModalOpen(false);
                                                router.push(resolveNotificationHref(notification.href));
                                            }}
                                            className="w-full text-left"
                                        >
                                            <p className="text-sm font-medium text-text">{notification.title}</p>
                                            <p className="text-xs text-muted line-clamp-2">{notification.description}</p>
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

            {isFeedbackModalOpen && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-8"
                    onClick={() => setIsFeedbackModalOpen(false)}
                >
                    <div
                        className="w-full max-w-[75vw] max-h-[75vh] overflow-y-auto rounded-2xl border border-default bg-surface shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Submit feedback"
                    >
                        <div className="flex items-center justify-between border-b border-default px-5 py-4">
                            <h2 className="text-lg font-semibold text-text">Leave Feedback</h2>
                            <button
                                type="button"
                                onClick={() => setIsFeedbackModalOpen(false)}
                                className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                                aria-label="Close feedback modal"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="grid gap-0 md:grid-cols-[1.35fr_0.65fr]">
                            <form className="border-b border-default p-5 md:border-b-0 md:border-r" onSubmit={handleFeedbackSubmit}>
                                <label htmlFor="feedback-input" className="mb-2 block text-sm font-medium text-text">
                                    What should we improve?
                                </label>
                                <textarea
                                    id="feedback-input"
                                    value={feedbackDraft}
                                    onChange={(event) => setFeedbackDraft(event.target.value)}
                                    rows={10}
                                    placeholder="Share details, repro steps, and what you expected to happen."
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {feedbackError && <p className="mt-3 text-sm text-red-500">{feedbackError}</p>}
                                <div className="mt-4 flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsFeedbackModalOpen(false)}
                                        className="rounded-md border border-default px-4 py-2 text-sm font-medium text-text hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingFeedback}
                                        className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                                    </button>
                                </div>
                            </form>

                            <aside className="max-h-[70vh] overflow-y-auto p-5">
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Past Feedback</h3>
                                {isFeedbackLoading ? (
                                    <p className="text-sm text-muted">Loading history...</p>
                                ) : feedbackItems.length === 0 ? (
                                    <p className="text-sm text-muted">No feedback submitted yet.</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {feedbackItems.map((item) => (
                                            <li key={item.id} className="rounded-lg border border-default bg-bg px-3 py-2">
                                                <p className="mb-2 line-clamp-4 text-sm text-text">{item.content || 'No content available.'}</p>
                                                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                                                    <span>{formatRelativeTime(item.createdAt)}</span>
                                                    {item.status && <span className="rounded-full border border-default px-2 py-0.5 capitalize">{item.status}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </aside>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
