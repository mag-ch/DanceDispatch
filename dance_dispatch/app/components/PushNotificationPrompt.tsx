'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { usePushNotifications } from '@/app/hooks/usePushNotifications';

const PROMPT_RESPONSE_KEY_PREFIX = 'dd_push_prompt_response_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type PromptResponseRecord = {
  respondedAt: string;
  enabled: boolean;
};

export function PushNotificationPrompt() {
  const { session, loading: authLoading } = useAuth();
  const {
    isSupported,
    isSubscribed,
    hasCheckedSubscription,
    permission,
    isLoading,
    error,
    subscribe,
  } = usePushNotifications();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canShowPrompt, setCanShowPrompt] = useState(false);
  const [hasLoadedPromptState, setHasLoadedPromptState] = useState(false);

  const userId = session?.user?.id ?? null;
  const responseStorageKey = useMemo(
    () => (userId ? `${PROMPT_RESPONSE_KEY_PREFIX}:${userId}` : null),
    [userId],
  );

  const savePromptResponse = (enabled: boolean) => {
    if (!responseStorageKey) {
      return;
    }

    const response: PromptResponseRecord = {
      respondedAt: new Date().toISOString(),
      enabled,
    };
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

  if (authLoading || !userId || !isSupported || !hasCheckedSubscription) {
    return null;
  }

  if (!hasLoadedPromptState || !canShowPrompt) {
    return null;
  }

  if (isSubscribed) {
    return null;
  }

  return (
    // Floating prompt stays visible so users can opt in/out without leaving their current page.
    <aside className="fixed bottom-4 left-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/95 p-4 shadow-2xl backdrop-blur-md">
      {/* Horizontal layout: status icon on the left, explanatory text and actions on the right. */}
      <div className="flex items-start gap-3">
        {/* Status icon gives immediate visual feedback about current subscription state. */}
        <div className="rounded-full bg-accent-soft p-2 text-text">
          {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        {/* Main content region updates messaging and available actions based on permission/subscription state. */}
        <div className="min-w-0 flex-1">
          {/* Static heading anchors the purpose of the prompt. */}
          <p className="text-sm font-semibold text-text">Push Notifications</p>
          {/* State-driven guidance tells users what to do next or why action is blocked. */}
          <p className="mt-1 text-sm text-muted">
            {isSubscribed
              ? 'This device is subscribed to DanceDispatch push notifications.'
              : permission === 'denied'
                ? 'Browser notifications are blocked for this site.'
                : 'Enable alerts to get notifications from friends and never miss a party!'}
          </p>

          {/* Error feedback appears after failed subscribe/unsubscribe/test attempts. */}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {/* Success feedback confirms completed actions so users trust the outcome. */}
          {successMessage && <p className="mt-2 text-sm text-green-600">{successMessage}</p>}

          {/* Action row conditionally reveals only the controls valid for the current state. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isSubscribed && permission !== 'denied' && (
              // Primary opt-in flow: clear prior success, request subscription, then confirm if enabled.
              <button
                type="button"
                onClick={async () => {
                  setSuccessMessage(null);
                  const subscribed = await subscribe();
                  savePromptResponse(subscribed);
                  setCanShowPrompt(false);
                  if (subscribed) {
                    setSuccessMessage('Push notifications enabled on this device.');
                  }
                }}
                disabled={isLoading}
                className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {isLoading ? 'Enabling...' : 'Enable Push'}
              </button>
            )}

            {!isSubscribed && (
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage(null);
                  savePromptResponse(false);
                  setCanShowPrompt(false);
                }}
                disabled={isLoading}
                className="rounded-md border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft disabled:opacity-60"
              >
                Not now
              </button>
            )}

            {/* {isSubscribed && isTestUser && (
              // Test flow (test user only): send a push, then report whether any subscription received it.
              <button
                type="button"
                onClick={async () => {
                  setSuccessMessage(null);
                  const payload = await sendTestNotification();
                  const sentCount = typeof payload?.sent === 'number' ? payload.sent : 0;
                  setSuccessMessage(sentCount > 0 ? 'Test notification sent.' : 'No active subscription was found for this user.');
                }}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-md border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isLoading ? 'Sending...' : 'Send Test'}
              </button>
            )} */}
          </div>
        </div>
      </div>
    </aside>
  );
}