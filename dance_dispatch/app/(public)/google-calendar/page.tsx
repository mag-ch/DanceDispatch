'use client';

import { useEffect, useMemo, useState } from 'react';

const WATCH_EXPIRATION_KEY = 'google_calendar_watch_expiration_ms';
const WATCH_CHANNEL_KEY = 'google_calendar_watch_channel';

function parseExpirationToMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }

    const dateMs = Date.parse(trimmed);
    if (Number.isFinite(dateMs)) {
      return dateMs;
    }
  }

  return null;
}

type WatchResult = {
  ok?: boolean;
  watch?: {
    id?: string;
    resourceId?: string;
    expiration?: string;
  };
  error?: string;
};

type WatchChannel = {
  id: string;
  resourceId: string;
};

type PendingReviewItem = {
  eventId: string;
  title: string;
  start: string | null;
  googleCalId: string | null;
  createdBy: string | null;
};

type PendingReviewResponse = {
  ok?: boolean;
  items?: PendingReviewItem[];
  error?: string;
};

export default function GoogleCalendarAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WatchResult | null>(null);
  const [activeExpirationMs, setActiveExpirationMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [pendingReviewItems, setPendingReviewItems] = useState<PendingReviewItem[]>([]);
  const [pendingReviewError, setPendingReviewError] = useState<string | null>(null);
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);


  useEffect(() => {
    const raw = window.localStorage.getItem(WATCH_EXPIRATION_KEY);
    const parsed = parseExpirationToMs(raw);
    if (parsed && parsed > Date.now()) {
      setActiveExpirationMs(parsed);
    } else {
      window.localStorage.removeItem(WATCH_EXPIRATION_KEY);
      setActiveExpirationMs(null);
    }
  }, []);

  useEffect(() => {
    if (!activeExpirationMs) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeExpirationMs]);

  const remainingMs = useMemo(() => {
    if (!activeExpirationMs) {
      return 0;
    }
    return Math.max(0, activeExpirationMs - nowMs);
  }, [activeExpirationMs, nowMs]);

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const pendingResponse = await fetch('/api/google-calendar/pending-events', {
          method: 'GET',
          cache: 'no-store',
        });

        const pendingPayload = (await pendingResponse.json()) as PendingReviewResponse;
        if (!pendingResponse.ok) {
          setPendingReviewError(pendingPayload.error || 'Failed to load pending review items');
          return;
        }

        setPendingReviewError(null);
        setPendingReviewItems(pendingPayload.items || []);
      } catch {
        setPendingReviewError('Failed to load pending review items');
      }
    };

    loadAdminData();
    const interval = window.setInterval(loadAdminData, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const remainingText = useMemo(() => {
    if (!activeExpirationMs || remainingMs <= 0) {
      return null;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (days > 0 || hours > 0) parts.push(`${hours}h`);
    if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }, [activeExpirationMs, remainingMs]);

  useEffect(() => {
    if (activeExpirationMs && activeExpirationMs <= nowMs) {
      window.localStorage.removeItem(WATCH_EXPIRATION_KEY);
      setActiveExpirationMs(null);
    }
  }, [activeExpirationMs, nowMs]);

const approvePendingReviewEvent = async (eventId: string, googleCalId: string | null) => {
    if (!eventId || !googleCalId || pendingApproveId || pendingDeleteId) return;

    setPendingApproveId(eventId);
    setPendingReviewError(null);

    try {
      const response = await fetch('/api/google-calendar/exclude-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleCalId }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setPendingReviewError(payload.error || 'Failed to approve pending event');
        return;
      }

      setPendingReviewItems((current) => current.filter((item) => item.eventId !== eventId));
    } catch {
      setPendingReviewError('Failed to approve pending event');
    } finally {
      setPendingApproveId(null);
    }
  };

  const deletePendingReviewEvent = async (eventId: string, googleCalId: string | null) => {
    if (!eventId || !googleCalId || pendingDeleteId || pendingApproveId) return;

    setPendingDeleteId(eventId);
    setPendingReviewError(null);

    try {
      // Step 1: same as Approve (exclude from pending review)
      const excludeResponse = await fetch('/api/google-calendar/exclude-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleCalId }),
      });

      const excludePayload = (await excludeResponse.json()) as { ok?: boolean; error?: string };
      if (!excludeResponse.ok) {
        setPendingReviewError(excludePayload.error || 'Failed to exclude pending event');
        return;
      }

      // Step 2: delete the event
      const deleteResponse = await fetch(`/api/event/${eventId}`, {
        method: 'DELETE',
      });

      const deletePayload = (await deleteResponse.json().catch(() => ({}))) as { error?: string };
      if (!deleteResponse.ok) {
        setPendingReviewError(deletePayload.error || 'Failed to delete event');
        return;
      }

      setPendingReviewItems((current) => current.filter((item) => item.eventId !== eventId));
    } catch {
      setPendingReviewError('Failed to delete pending event');
    } finally {
      setPendingDeleteId(null);
    }
  };


  const registerWatch = async () => {
    setLoading(true);
    setResult(null);

    try {
      const previousChannelRaw = window.localStorage.getItem(WATCH_CHANNEL_KEY);
      let previousChannelParsed: Partial<WatchChannel> | null = null;
      if (previousChannelRaw) {
        try {
          previousChannelParsed = JSON.parse(previousChannelRaw) as Partial<WatchChannel>;
        } catch {
          previousChannelParsed = null;
        }
      }
      const previousChannel =
        previousChannelParsed?.id && previousChannelParsed?.resourceId
          ? {
              id: String(previousChannelParsed.id),
              resourceId: String(previousChannelParsed.resourceId),
            }
          : undefined;

      const response = await fetch('/api/google-calendar/watch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previousChannel,
        }),
      });

      const payload = (await response.json()) as WatchResult;
      setResult(payload);

      const expirationValue = payload.watch?.expiration;
      const expirationMs = parseExpirationToMs(expirationValue);
      if (expirationMs && expirationMs > Date.now()) {
        window.localStorage.setItem(WATCH_EXPIRATION_KEY, String(expirationMs));
        setActiveExpirationMs(expirationMs);
      }

      const channelId = payload.watch?.id;
      const resourceId = payload.watch?.resourceId;
      if (channelId && resourceId) {
        window.localStorage.setItem(
          WATCH_CHANNEL_KEY,
          JSON.stringify({
            id: channelId,
            resourceId,
          })
        );
      }
    } catch {
      setResult({ error: 'Request failed. Check your network and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-text">Google Calendar Admin</h1>
      <p className="mt-2 text-sm text-muted">
        Register a Google Calendar watch channel that delivers webhook notifications to
        <span className="font-mono"> /google-calendar/events</span>.
      </p>

      {remainingText ? (
        <div className="mt-4 rounded-md border border-default bg-surface p-3 text-sm text-text">
          Active watch channel expires in <strong>{remainingText}</strong>
        </div>
      ) : null}

      <button
        type="button"
        onClick={registerWatch}
        disabled={loading}
        className="mt-6 rounded-md border border-default bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Registering watch...' : 'Register watch channel'}
      </button>

      {result ? (
        <pre className="mt-6 overflow-auto rounded-md border border-default bg-surface p-4 text-xs text-text">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text">Pending Events For Manual Review</h2>
        <p className="mt-1 text-xs text-muted">Rows with `exclude = false` from `pending_events`.</p>
        {pendingReviewError ? (
          <p className="mt-2 text-xs text-red-500">{pendingReviewError}</p>
        ) : null}
        <div className="mt-2 rounded-md border border-default bg-surface p-3">
          {pendingReviewItems.length === 0 ? (
            <p className="text-xs text-muted">No pending events for manual review.</p>
          ) : (
            <ul className="space-y-2">
              {pendingReviewItems.map((item) => (
                <li
                  key={item.eventId}
                  className="flex items-center gap-3 rounded border border-default/50 bg-surface/50 p-2"
                >
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => {
                      window.location.href = `/events/${item.eventId}`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        window.location.href = `/events/${item.eventId}`;
                      }
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    <div className="text-sm font-medium text-text">{item.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      Event #{item.eventId}
                      {item.start ? ` • ${new Date(item.start).toLocaleString()}` : ''}
                      {item.googleCalId ? ` • Google ID: ${item.googleCalId}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void deletePendingReviewEvent(item.eventId, item.googleCalId);
                    }}
                    disabled={pendingDeleteId === item.eventId || !item.googleCalId}
                    className="shrink-0 rounded-md border border-default px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingDeleteId === item.eventId ? 'Deleting...' : item.googleCalId ? 'Delete' : 'No Google ID'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void approvePendingReviewEvent(item.eventId, item.googleCalId);
                    }}
                    disabled={pendingApproveId === item.eventId || !item.googleCalId}
                    className="shrink-0 rounded-md border border-default px-3 py-2 text-xs font-medium text-text hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingApproveId === item.eventId ? 'Approving...' : item.googleCalId ? 'Approve' : 'No Google ID'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
