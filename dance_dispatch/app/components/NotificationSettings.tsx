"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";

export function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
  } = usePushNotifications();

  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async () => {
    setIsSaving(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        if (permission !== "granted") {
          const perm = await requestPermission();
          if (perm !== "granted") {
            setIsSaving(false);
            return;
          }
        }
        await subscribe();
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          Push notifications are not supported on this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Event Notifications
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isSubscribed
                  ? "You will receive notifications about new events and updates"
                  : "Get notified about new events and updates"}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={isSaving || isLoading}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              isSubscribed
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-300 hover:bg-gray-400"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={isSubscribed ? "Disable notifications" : "Enable notifications"}
          >
            <div
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                isSubscribed ? "translate-x-7" : "translate-x-1"
              }`}
            />
            {(isSaving || isLoading) && (
              <Loader2 className="absolute w-4 h-4 animate-spin text-gray-600" />
            )}
          </button>
        </div>

        {permission === "denied" && !isSubscribed && (
          <div className="mt-3 rounded bg-amber-50 dark:bg-amber-900/20 p-2 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              You have disabled notifications. Enable them in your browser settings to receive push notifications.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded bg-red-50 dark:bg-red-900/20 p-2 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-400">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          Notification Types
        </h4>
        <ul className="space-y-2 text-xs">
          <li>• New events matching your interests</li>
          <li>• Updates to events you saved</li>
          <li>• New followers and reviews</li>
          <li>• Special promotions and announcements</li>
        </ul>
      </div>
    </div>
  );
}
