'use client';

import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  Circle,
  Trophy,
  X,
  Share2,
  Calendar,
  Music2,
  MapPin,
  User,
  Wrench,
  Star,
  Rocket,
} from 'lucide-react';
import { Suspense, use, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'shared_item'
  | 'followed_user_rsvp'
  | 'followed_user_comment'
  | 'followed_dj_new_event'
  | 'followed_venue_new_event'
  | 'patch_notes'
  | 'new_badge_unlocked'
  | 'new_user_missions';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

type PatchNoteMetadata = {
  id: string;
  description: string;
  created_at: string;
};

type MissionStatus = {
  savedEvent: boolean;
  followedHost: boolean;
  followedVenue: boolean;
  followedUser: boolean;
  wroteReview: boolean;
  allComplete: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LAST_VIEWED_KEY = 'dd_notifications_last_viewed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return 'Date TBD';
  const normalized = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12, 0, 0
    ).toDateString();
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toDateString();
}

function getLastViewedTimestamp(): number {
  if (typeof window === 'undefined') return Date.now();
  const raw = window.localStorage.getItem(LAST_VIEWED_KEY);
  return raw ? Number(raw) : 0;
}

function setLastViewedTimestamp(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_VIEWED_KEY, String(Date.now()));
  }
}

function isUnread(createdAt: string, lastViewed: number): boolean {
  const ts = Date.parse(createdAt);
  return !Number.isNaN(ts) && ts > lastViewed;
}

// ─── Icon per notification type ───────────────────────────────────────────────

function NotificationIcon({ type }: { type: NotificationType }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'shared_item':           return <Share2   className={cls} />;
    case 'followed_user_rsvp':    return <Calendar className={cls} />;
    case 'followed_user_comment': return <User     className={cls} />;
    case 'followed_dj_new_event': return <Music2   className={cls} />;
    case 'followed_venue_new_event': return <MapPin className={cls} />;
    case 'patch_notes':           return <Wrench   className={cls} />;
    case 'new_user_missions':     return <Rocket   className={cls} />;
    case 'new_badge_unlocked':    return <Star     className={cls} />;
    default:                      return <Bell     className={cls} />;
  }
}

// ─── Main page content ────────────────────────────────────────────────────────

function NotificationsFeedPageContent() {
  const [notifications, setNotifications]     = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [lastViewed, setLastViewed]           = useState<number>(0);
  const [unreadCount, setUnreadCount]         = useState(0);
  const markedReadRef                         = useRef(false);

  const [patchNoteMetadata, setPatchNoteMetadata]   = useState<PatchNoteMetadata | null>(null);
  const [isPatchNoteLoading, setIsPatchNoteLoading] = useState(false);
  const [patchNoteError, setPatchNoteError]         = useState<string | null>(null);

  const [missionStatus, setMissionStatus]   = useState<MissionStatus | null>(null);
  const [isMissionLoading, setIsMissionLoading] = useState(false);
  const [missionError, setMissionError]     = useState<string | null>(null);

  const pathname     = usePathname();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const patchNotesId = searchParams?.get('patchNotes')?.trim() ?? '';
  const showMissions = searchParams?.get('newUserMissions') === 'true';

  // Read last-viewed on mount
  useEffect(() => {
    setLastViewed(getLastViewedTimestamp());
  }, []);

  const resolveNotificationHref = useCallback((href: string) => {
    if (!href.startsWith('?')) return href;
    const params     = new URLSearchParams(searchParams?.toString() ?? '');
    const nextParams = new URLSearchParams(href.slice(1));
    nextParams.forEach((value, key) => params.set(key, value));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const closePatchNotesModal = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('patchNotes');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const closeMissionsModal = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('newUserMissions');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=50', { cache: 'no-store' });
      if (!res.ok) { setNotifications([]); return; }
      const data = (await res.json()) as NotificationItem[];
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);

      // Count unread against the timestamp we captured on mount
      const lv = getLastViewedTimestamp();
      setUnreadCount(list.filter((n) => isUnread(n.createdAt, lv)).length);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark all as read when user visits the page — debounced to after first render
  useEffect(() => {
    if (markedReadRef.current) return;
    markedReadRef.current = true;
    // Small delay so unread badges render for a moment before clearing
    const t = setTimeout(() => {
      setLastViewedTimestamp();
      setLastViewed(Date.now());
      setUnreadCount(0);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    void loadNotifications();

    const channel = supabase
      .channel('notifications-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Events' },       () => void loadNotifications())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'SavedEvents' },  () => void loadNotifications())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Reviews' },      () => void loadNotifications())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'SharedItems' },  () => void loadNotifications())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_badges' },  () => void loadNotifications())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadNotifications]);

  // Patch note modal
  useEffect(() => {
    if (!patchNotesId) {
      setPatchNoteMetadata(null);
      setPatchNoteError(null);
      setIsPatchNoteLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsPatchNoteLoading(true);
    setPatchNoteError(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(patchNotesId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: 'Failed to load patch note.' }));
          setPatchNoteError(typeof payload?.error === 'string' ? payload.error : 'Failed to load patch note.');
          return;
        }
        setPatchNoteMetadata((await res.json()) as PatchNoteMetadata);
      } catch (err) {
        if (!controller.signal.aborted) setPatchNoteError('Failed to load patch note.');
      } finally {
        if (!controller.signal.aborted) setIsPatchNoteLoading(false);
      }
    };

    void load();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePatchNotesModal(); };
    window.addEventListener('keydown', onKey);
    return () => { controller.abort(); window.removeEventListener('keydown', onKey); };
  }, [closePatchNotesModal, patchNotesId]);

  // Missions modal
  useEffect(() => {
    if (!showMissions) {
      setMissionStatus(null);
      setMissionError(null);
      setIsMissionLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsMissionLoading(true);
    setMissionError(null);

    const load = async () => {
      try {
        const res = await fetch('/api/notifications/missions', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: 'Failed to load missions.' }));
          setMissionError(typeof payload?.error === 'string' ? payload.error : 'Failed to load missions.');
          return;
        }
        setMissionStatus((await res.json()) as MissionStatus);
      } catch (err) {
        if (!controller.signal.aborted) setMissionError('Failed to load missions.');
      } finally {
        if (!controller.signal.aborted) setIsMissionLoading(false);
      }
    };

    void load();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMissionsModal(); };
    window.addEventListener('keydown', onKey);
    return () => { controller.abort(); window.removeEventListener('keydown', onKey); };
  }, [closeMissionsModal, showMissions]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <section className="mx-auto max-w-3xl rounded-xl border border-default bg-surface p-6 shadow-sm">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-6 w-6 text-text" />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text">Notifications</h1>
          </div>
          {!isLoading && notifications.length > 0 && (
            <span className="text-xs text-muted">{notifications.length} total</span>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <ul className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <li key={i} className="h-20 animate-pulse rounded-lg border border-default bg-muted/10" />
            ))}
          </ul>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Bell className="h-10 w-10 text-muted opacity-40" />
            <p className="text-sm text-muted">No notifications yet.</p>
            <p className="text-xs text-muted opacity-70">Follow DJs, venues, and users to get updates here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification) => {
              const unread = isUnread(notification.createdAt, lastViewed);
              return (
                <li
                  key={notification.id}
                  className={`relative rounded-lg border p-4 transition-colors ${
                    unread
                      ? 'border-cyan-500/40 bg-cyan-500/5'
                      : 'border-default bg-transparent hover:bg-surface'
                  }`}
                >
                  {/* Unread dot */}
                  {unread && (
                    <span
                      className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-500"
                      aria-label="Unread"
                    />
                  )}

                  <div className={`flex items-start gap-3 ${unread ? 'pl-4' : ''}`}>
                    {/* Type icon */}
                    <span className="mt-0.5 shrink-0 text-muted">
                      <NotificationIcon type={notification.type} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-start justify-between gap-2">
                        <h2 className={`text-sm font-semibold leading-snug text-text ${unread ? 'font-bold' : ''}`}>
                          {notification.title}
                        </h2>
                        <span className="shrink-0 text-xs text-muted">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="mb-2 text-sm text-muted line-clamp-2">{notification.description}</p>
                      <Link
                        href={resolveNotificationHref(notification.href)}
                        className="text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Patch notes modal ──────────────────────────────────────── */}
      {patchNotesId && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-8"
          onClick={closePatchNotesModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Patch notes"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                  {formatEventDate(patchNoteMetadata?.created_at)}
                </p>
                <h2 className="text-xl font-semibold text-text">Patch Note #{patchNotesId}</h2>
              </div>
              <button
                type="button"
                onClick={closePatchNotesModal}
                className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close patch notes modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label htmlFor="patch-notes-description" className="mb-2 mt-4 block text-sm font-medium text-text">
              Description
            </label>
            <textarea
              id="patch-notes-description"
              value={patchNoteMetadata?.description ?? ''}
              readOnly
              rows={6}
              className="w-full rounded-lg border border-default bg-bg px-4 py-3 text-sm text-text"
            />
            {isPatchNoteLoading && <p className="mt-3 text-sm text-muted">Loading patch note...</p>}
            {patchNoteError   && <p className="mt-3 text-sm text-red-600">{patchNoteError}</p>}
          </div>
        </div>
      )}

      {/* ── Missions modal ─────────────────────────────────────────── */}
      {showMissions && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-8"
          onClick={closeMissionsModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="New user missions"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Getting Started</p>
                <h2 className="text-xl font-semibold text-text">New User Missions</h2>
              </div>
              <button
                type="button"
                onClick={closeMissionsModal}
                className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close missions modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isMissionLoading && <p className="text-sm text-muted">Loading missions...</p>}
            {missionError     && <p className="text-sm text-red-600">{missionError}</p>}

            {!isMissionLoading && !missionError && (
              <ul className="space-y-4">
                {(
                  [
                    { key: 'savedEvent',    label: 'Discover the Floor',  desc: 'Save your first event.',         href: '/search?categories=events',  cta: 'Browse Events' },
                    { key: 'followedHost',  label: 'Find Your Vibe',      desc: 'Follow your first DJ or host.',  href: '/search?categories=hosts',   cta: 'Browse DJs' },
                    { key: 'followedVenue', label: "That's the spot",     desc: 'Follow your first venue.',       href: '/search?categories=venues',  cta: 'Browse Venues' },
                    { key: 'followedUser',  label: 'Make a friend',       desc: 'Follow your first user.',        href: '/search?categories=users',   cta: 'Browse Users' },
                    { key: 'wroteReview',   label: 'Share Your Story',    desc: 'Write your first event review.', href: '/search?categories=events',  cta: 'Find an Event' },
                  ] as const
                ).map(({ key, label, desc, href, cta }) => (
                  <li key={key} className="flex items-start gap-3">
                    {missionStatus?.[key]
                      ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                      : <Circle       className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                    <div>
                      <p className="font-semibold text-text">{label}</p>
                      <p className="text-sm text-muted">{desc}</p>
                      {!missionStatus?.[key] && (
                        <Link href={href} className="mt-1 inline-block text-xs font-medium hover:underline">
                          {cta} →
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {missionStatus?.allComplete && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-yellow-400/40 bg-yellow-50/60 px-4 py-3 dark:bg-yellow-900/20">
                <Trophy className="h-6 w-6 shrink-0 text-yellow-500" />
                <div>
                  <p className="font-semibold text-text">Explorer Badge Unlocked!</p>
                  <p className="text-sm text-muted">Your badge is now visible on your profile page.</p>
                </div>
              </div>
            )}

            {!missionStatus?.allComplete && !isMissionLoading && !missionError && (
              <p className="mt-5 text-center text-xs text-muted">
                Complete all missions to earn the{' '}
                <span className="font-semibold text-text">Explorer Badge</span> on your profile.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function NotificationsFeedPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-3xl rounded-xl border border-default bg-surface p-6 shadow-sm">
          <p className="text-sm text-muted">Loading notifications...</p>
        </section>
      }
    >
      <NotificationsFeedPageContent />
    </Suspense>
  );
}

