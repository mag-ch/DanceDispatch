'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import {
  LOCATION_ENABLED_EVENT,
  LOCATION_PROMPT_KEY_PREFIX,
  useLocationCheckIn,
} from '@/app/hooks/useLocationCheckIn';

export function LocationEnablePrompt() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const [visible, setVisible] = useState(false);
  const { isSupported, isLoading, error, requestEnable } = useLocationCheckIn(false);

  const storageKey = useMemo(
    () => (userId ? `${LOCATION_PROMPT_KEY_PREFIX}:${userId}` : null),
    [userId],
  );

  // Prompt once per user per device: any stored response suppresses it.
  useEffect(() => {
    setVisible(!!storageKey && localStorage.getItem(storageKey) === null);
  }, [storageKey]);

  if (authLoading || !userId || !isSupported || !visible || !storageKey) {
    return null;
  }

  const saveResponse = (enabled: boolean) => {
    localStorage.setItem(storageKey, JSON.stringify({ respondedAt: new Date().toISOString(), enabled }));
    setVisible(false);
  };

  return (
    <aside className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/40 dark:bg-surface/40 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-accent-soft p-2 text-text">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Enable Location</p>
          <p className="mt-1 text-sm text-muted">
            Let DanceDispatch confirm you made it to events you RSVP&apos;d to and notify you when you arrive.
          </p>

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const enabled = await requestEnable();
                saveResponse(enabled);
                if (enabled) window.dispatchEvent(new Event(LOCATION_ENABLED_EVENT));
              }}
              disabled={isLoading}
              className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isLoading ? 'Enabling...' : 'Enable Location'}
            </button>

            <button
              type="button"
              onClick={() => saveResponse(false)}
              disabled={isLoading}
              className="rounded-md border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
