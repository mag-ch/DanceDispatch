'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';

const WATCH_EXPIRATION_KEY = 'google_calendar_watch_expiration_ms';

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

type WebhookLogItem = {
  id: string;
  createdAt: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: Record<string, unknown>;
};

type WebhookLogsResponse = {
  ok?: boolean;
  logs?: WebhookLogItem[];
  error?: string;
};

export default function GoogleCalendarAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WatchResult | null>(null);
  const [activeExpirationMs, setActiveExpirationMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

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
    const loadLogs = async () => {
      try {
        const response = await fetch('/api/google-calendar/webhook-logs', {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as WebhookLogsResponse;
        if (!response.ok) {
          setLogsError(payload.error || 'Failed to load webhook logs');
          return;
        }

        setLogsError(null);
        setWebhookLogs(payload.logs || []);
      } catch {
        setLogsError('Failed to load webhook logs');
      }
    };

    loadLogs();
    const interval = window.setInterval(loadLogs, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [webhookLogs]);

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

  const registerWatch = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/google-calendar/watch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const payload = (await response.json()) as WatchResult;
      setResult(payload);

      const expirationValue = payload.watch?.expiration;
      const expirationMs = parseExpirationToMs(expirationValue);
      if (expirationMs && expirationMs > Date.now()) {
        window.localStorage.setItem(WATCH_EXPIRATION_KEY, String(expirationMs));
        setActiveExpirationMs(expirationMs);
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
        <h2 className="text-sm font-semibold text-text">Webhook Event Log</h2>
        <p className="mt-1 text-xs text-muted">Auto-refreshes every 5 seconds.</p>
        {logsError ? (
          <p className="mt-2 text-xs text-red-500">{logsError}</p>
        ) : null}
        <div
          ref={logsContainerRef}
          className="mt-2 h-64 overflow-y-auto rounded-md border border-default bg-surface p-3"
        >
          {webhookLogs.length === 0 ? (
            <p className="text-xs text-muted">No webhook events logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {webhookLogs.map((entry) => (
                <li key={entry.id} className="rounded border border-default/50 bg-surface/50 p-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-text">{entry.event}</span>
                    <span className="text-muted">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">{entry.level}</div>
                  {entry.details ? (
                    <pre className="mt-2 overflow-auto rounded bg-black/5 p-2 text-[11px] text-text">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
