'use client';

import { useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { usePushNotifications } from '@/app/hooks/usePushNotifications';
import { PUSH_TEST_USER_ID } from '@/lib/push-notification-constants';

export function PushNotificationPrompt() {
  const { session, loading: authLoading } = useAuth();
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (authLoading || !session?.user?.id || !isSupported) {
    return null;
  }

  const isTestUser = session.user.id === PUSH_TEST_USER_ID;

  return (
    <aside className="fixed bottom-4 left-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-accent-soft p-2 text-text">
          {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Push Notifications</p>
          <p className="mt-1 text-sm text-muted">
            {isSubscribed
              ? 'This device is subscribed to DanceDispatch push notifications.'
              : permission === 'denied'
                ? 'Browser notifications are blocked for this site.'
                : 'Enable alerts to get notifications from friends and never miss a party!'}
          </p>

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {successMessage && <p className="mt-2 text-sm text-green-600">{successMessage}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!isSubscribed && permission !== 'denied' && (
              <button
                type="button"
                onClick={async () => {
                  setSuccessMessage(null);
                  const subscribed = await subscribe();
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

            {isSubscribed && (
              <button
                type="button"
                onClick={async () => {
                  setSuccessMessage(null);
                  const unsubscribed = await unsubscribe();
                  if (unsubscribed) {
                    setSuccessMessage('Push notifications disabled on this device.');
                  }
                }}
                disabled={isLoading}
                className="rounded-md border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft disabled:opacity-60"
              >
                {isLoading ? 'Working...' : 'Turn Off'}
              </button>
            )}

            {isSubscribed && isTestUser && (
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
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}