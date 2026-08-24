'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { useLocationCheckIn } from '@/app/hooks/useLocationCheckIn';

const PROMPT_RESPONSE_KEY_PREFIX = 'dd_location_checkin_response_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type PromptResponseRecord = {
  respondedAt: string;
  enabled: boolean;
};

export function LocationCheckIn() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;

  const [canShowPrompt, setCanShowPrompt] = useState(false);
  const [hasLoadedPromptState, setHasLoadedPromptState] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const { isSupported, isLoading, error, requestEnable } = useLocationCheckIn(isEnabled);

  const responseStorageKey = useMemo(
    () => (userId ? `${PROMPT_RESPONSE_KEY_PREFIX}:${userId}` : null),
    [userId],
  );

  const savePromptResponse = (enabled: boolean) => {
    if (!responseStorageKey) {
      return;
    }

    const response: PromptResponseRecord = { respondedAt: new Date().toISOString(), enabled };
    localStorage.setItem(responseStorageKey, JSON.stringify(response));
  };

  useEffect(() => {
    if (!responseStorageKey) {
      setCanShowPrompt(false);
      setHasLoadedPromptState(false);
      return;
    }

    let shouldShow = true;
    const rawRecord = localStorage.getItem(responseStorageKey);

    if (rawRecord) {
      try {
        const parsedRecord = JSON.parse(rawRecord) as PromptResponseRecord;
        const respondedAtMs = new Date(parsedRecord.respondedAt).getTime();
        const hasValidDate = Number.isFinite(respondedAtMs);

        if (parsedRecord.enabled) {
          shouldShow = false;
          setIsEnabled(true);
        } else if (hasValidDate) {
          shouldShow = Date.now() - respondedAtMs >= THIRTY_DAYS_MS;
        }
      } catch {
        // Ignore malformed localStorage data and fall back to showing the prompt.
      }
    }

    setCanShowPrompt(shouldShow);
    setHasLoadedPromptState(true);
  }, [responseStorageKey]);

  if (authLoading || !userId || !isSupported) {
    return null;
  }

  if (isEnabled || !hasLoadedPromptState || !canShowPrompt) {
    return null;
  }

  return (
    // Floating prompt, similar to the push notification prompt, offered as a separate opt-in.
    <aside className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-accent-soft p-2 text-text">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Location Check-In</p>
          <p className="mt-1 text-sm text-muted">
            Let DanceDispatch confirm you made it to events you RSVP&apos;d to and notify you when you arrive.
          </p>

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const enabled = await requestEnable();
                savePromptResponse(enabled);
                setIsEnabled(enabled);
                setCanShowPrompt(false);
              }}
              disabled={isLoading}
              className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isLoading ? 'Enabling...' : 'Enable Check-In'}
            </button>

            <button
              type="button"
              onClick={() => {
                savePromptResponse(false);
                setCanShowPrompt(false);
              }}
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
