'use client';

import { useState } from 'react';
import { usePushNotifications } from '@/app/hooks/usePushNotifications';

export default function NotificationSubscriptionToggle() {
  const {
    isSupported,
    isSubscribed,
    hasCheckedSubscription,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onToggle = async () => {
    setSuccessMessage(null);

    if (isSubscribed) {
      const unsubscribed = await unsubscribe();
      if (unsubscribed) {
        setSuccessMessage('Push notifications disabled on this device.');
      }
      return;
    }

    const subscribed = await subscribe();
    if (subscribed) {
      setSuccessMessage('Push notifications enabled on this device.');
    }
  };

  return (
    <div className="space-y-2 mt-4">
      <p className="text-sm text-text">Push Notifications</p>

      {!isSupported && (
        <p className="text-sm text-muted">Push notifications are not supported in this browser.</p>
      )}

      {isSupported && !hasCheckedSubscription && (
        <p className="text-sm text-muted">Checking subscription status...</p>
      )}

      {isSupported && hasCheckedSubscription && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            {isSubscribed
              ? 'Enabled for this device.'
              : permission === 'denied'
                ? 'Blocked in browser settings for this site.'
                : 'Disabled for this device.'}
          </p>

          <button
            type="button"
            onClick={onToggle}
            disabled={isLoading}
            className="w-fit rounded-md border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft disabled:opacity-60"
          >
            {isLoading ? 'Working...' : isSubscribed ? 'Turn Off' : 'Enable Push'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
    </div>
  );
}