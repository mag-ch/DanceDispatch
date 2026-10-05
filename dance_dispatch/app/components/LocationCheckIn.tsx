'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin, X } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import {
  LOCATION_ENABLED_EVENT,
  LOCATION_PROMPT_KEY_PREFIX,
  LocationConfirmation,
  useLocationCheckIn,
} from '@/app/hooks/useLocationCheckIn';

const TOAST_DURATION_MS = 8000;

export function LocationCheckIn() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [isEnabled, setIsEnabled] = useState(false);
  const [confirmed, setConfirmed] = useState<LocationConfirmation | null>(null);

  const storageKey = useMemo(
    () => (userId ? `${LOCATION_PROMPT_KEY_PREFIX}:${userId}` : null),
    [userId],
  );

  useEffect(() => {
    const readEnabled = () => {
      if (!storageKey) {
        setIsEnabled(false);
        return;
      }
      try {
        const record = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
        setIsEnabled(record?.enabled === true);
      } catch {
        setIsEnabled(false);
      }
    };

    readEnabled();
    window.addEventListener(LOCATION_ENABLED_EVENT, readEnabled);
    return () => window.removeEventListener(LOCATION_ENABLED_EVENT, readEnabled);
  }, [storageKey]);

  const handleConfirmed = useCallback((confirmations: LocationConfirmation[]) => {
    setConfirmed(confirmations[0]);
  }, []);

  useLocationCheckIn(isEnabled && !authLoading, handleConfirmed);

  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(() => setConfirmed(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [confirmed]);

  if (!confirmed) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/40 dark:bg-surface/40 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-accent-soft p-2 text-text">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">You&apos;re checked in!</p>
          <p className="mt-1 text-sm text-muted">
            Location confirmed at{' '}
            <Link href={`/events/${confirmed.eventId}`} className="underline">
              {confirmed.eventTitle}
            </Link>
            . Have fun!
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmed(null)}
          className="p-1 text-muted hover:text-text"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
