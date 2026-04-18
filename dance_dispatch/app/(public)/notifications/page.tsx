'use client';

import Link from 'next/link';
import { Bell, CheckCircle2, Circle, Trophy, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type NotificationItem = {
  id: string;
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

function NotificationsFeedPageContent() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [patchNoteMetadata, setPatchNoteMetadata] = useState<PatchNoteMetadata | null>(null);
  const [isPatchNoteLoading, setIsPatchNoteLoading] = useState(false);
  const [patchNoteError, setPatchNoteError] = useState<string | null>(null);
  const [missionStatus, setMissionStatus] = useState<MissionStatus | null>(null);
  const [isMissionLoading, setIsMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patchNotesId = searchParams?.get('patchNotes')?.trim() ?? '';
  const showMissions = searchParams?.get('newUserMissions') === 'true';


  const formatEventDate = (dateStr?: string) => {
      if (!dateStr) return 'Date TBD';

      const normalized = dateStr.trim();
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
      if (match) {
          const year = Number(match[1]);
          const month = Number(match[2]) - 1;
          const day = Number(match[3]);
          // Use local noon to avoid DST/UTC boundary shifts.
          return new Date(year, month, day, 12, 0, 0).toDateString();
      }

      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? normalized : parsed.toDateString();
  };

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

    const loadPatchNote = async () => {
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(patchNotesId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorPayload = await res
            .json()
            .catch(() => ({ error: 'Failed to load patch note metadata.' }));
          setPatchNoteMetadata(null);
          setPatchNoteError(
            typeof errorPayload?.error === 'string'
              ? errorPayload.error
              : 'Failed to load patch note metadata.'
          );
          return;
        }

        const data = (await res.json()) as PatchNoteMetadata;
        setPatchNoteMetadata(data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setPatchNoteMetadata(null);
        setPatchNoteError('Failed to load patch note metadata.');
      } finally {
        if (!controller.signal.aborted) {
          setIsPatchNoteLoading(false);
        }
      }
    };

    void loadPatchNote();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePatchNotesModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      controller.abort();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePatchNotesModal, patchNotesId]);

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

    const loadMissions = async () => {
      try {
        const res = await fetch('/api/notifications/missions', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorPayload = await res.json().catch(() => ({ error: 'Failed to load mission status.' }));
          setMissionError(typeof errorPayload?.error === 'string' ? errorPayload.error : 'Failed to load mission status.');
          return;
        }

        const data = (await res.json()) as MissionStatus;
        setMissionStatus(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        setMissionError('Failed to load mission status.');
      } finally {
        if (!controller.signal.aborted) setIsMissionLoading(false);
      }
    };

    void loadMissions();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMissionsModal();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      controller.abort();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMissionsModal, showMissions]);

  return (
    <>
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
                <Link href={resolveNotificationHref(notification.href)} className="text-sm font-medium hover:underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {patchNotesId && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-8"
          onClick={closePatchNotesModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Patch notes"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{formatEventDate(patchNoteMetadata?.created_at)}</p>
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

            {isPatchNoteLoading && <p className="mt-3 text-sm text-muted">Loading patch note metadata...</p>}
            {patchNoteError && <p className="mt-3 text-sm text-red-600">{patchNoteError}</p>}
          </div>
        </div>
      )}

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
            {missionError && <p className="text-sm text-red-600">{missionError}</p>}

            {!isMissionLoading && !missionError && (
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  {missionStatus?.savedEvent
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                  <div>
                    <p className="font-semibold text-text">Discover the Floor</p>
                    <p className="text-sm text-muted">Save your first event to your calendar.</p>
                    {!missionStatus?.savedEvent && (
                      <Link href="/search?categories=events" className="mt-1 inline-block text-xs font-medium hover:underline">Browse Events →</Link>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {missionStatus?.followedHost
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                  <div>
                    <p className="font-semibold text-text">Find Your Vibe</p>
                    <p className="text-sm text-muted">Follow your first DJ or host.</p>
                    {!missionStatus?.followedHost && (
                      <Link href="/search?categories=hosts" className="mt-1 inline-block text-xs font-medium hover:underline">Browse DJs →</Link>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {missionStatus?.followedVenue
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                  <div>
                    <p className="font-semibold text-text">That's the spot</p>
                    <p className="text-sm text-muted">Follow your first venue.</p>
                    {!missionStatus?.followedVenue && (
                      <Link href="/search?categories=venues" className="mt-1 inline-block text-xs font-medium hover:underline">Browse Venues →</Link>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {missionStatus?.followedUser
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                  <div>
                    <p className="font-semibold text-text">Make a friend</p>
                    <p className="text-sm text-muted">Follow your first user.</p>
                    {!missionStatus?.followedUser && (
                      <Link href="/search?categories=users" className="mt-1 inline-block text-xs font-medium hover:underline">Browse Users →</Link>
                    )}
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {missionStatus?.wroteReview
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                  <div>
                    <p className="font-semibold text-text">Share Your Story</p>
                    <p className="text-sm text-muted">Write your first event review.</p>
                    {!missionStatus?.wroteReview && (
                      <Link href="/search?categories=events" className="mt-1 inline-block text-xs font-medium hover:underline">Find an Event →</Link>
                    )}
                  </div>
                </li>
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
                Complete all three missions to earn the <span className="font-semibold text-text">Explorer Badge</span> on your profile.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function NotificationsFeedPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-3xl rounded-xl border border-default bg-surface p-6 shadow-sm"><p className="text-sm text-muted">Loading notifications...</p></section>}>
      <NotificationsFeedPageContent />
    </Suspense>
  );
}
