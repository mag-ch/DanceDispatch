"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";

const DISMISS_UNTIL_KEY = "dd_push_prompt_dismiss_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isDismissedInStorage(): boolean {
  if (typeof window === "undefined") return false;
  const storedUntil = window.localStorage.getItem(DISMISS_UNTIL_KEY);
  const untilTs = Number(storedUntil);
  if (!storedUntil || Number.isNaN(untilTs)) return false;
  return Date.now() < untilTs;
}

export function PushNotificationPrompt() {
  const { isSupported, isSubscribed, permission, isLoading, subscribe, requestPermission } =
    usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize visibility
  useEffect(() => {
    if (!isSupported) return;

    // Don't show if already subscribed
    if (isSubscribed) {
      setShowPrompt(false);
      return;
    }

    // Don't show if dismissed
    if (isDismissedInStorage()) {
      setShowPrompt(false);
      return;
    }

    // Don't show if permission is denied
    if (permission === "denied") {
      setShowPrompt(false);
      return;
    }

    // Show the prompt
    setShowPrompt(true);
    setIsVisible(true);
  }, [isSupported, isSubscribed, permission]);

  const handleDismiss = () => {
    setIsVisible(false);
    // Set cooldown
    window.localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + DISMISS_MS));
  };

  const handleEnable = async () => {
    console.log("User opted to enable push notifications");
    setLoading(true);
    if (permission !== "granted") {
      // Request permission first
      const perm = await requestPermission();
      if (perm !== "granted") {
        handleDismiss();
        return;
      }
    }

    // Subscribe
    const success = await subscribe();
    if (success) {
      setShowPrompt(false);
      setIsVisible(false);
    }
    setLoading(false);
  };

  if (!showPrompt || !isVisible || !isSupported) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50">
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg shadow-lg p-4 text-white">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Get Event Notifications</h3>
            <p className="text-xs opacity-90">
              Enable notifications to get updates about new events, saved parties, and more!
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1 bg-white text-cyan-600 hover:bg-gray-100 disabled:opacity-50 px-3 py-2 rounded font-medium text-sm transition-colors"
          >
            {loading ? "Enabling..." : "Enable"}
          </button>
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="flex-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 px-3 py-2 rounded font-medium text-sm transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
