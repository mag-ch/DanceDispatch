"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/providers/AuthContext";

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  isLoading: boolean;
  error: string|null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { session, loading: authLoading } = useAuth();
  
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() => isSupported());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "denied";
    return Notification.permission;
  });
  // isLoading covers: initial SW/subscription check, subscribe, and unsubscribe operations.
  // We start true so the prompt never flashes before we know the subscription state.
  const [isLoading, setIsLoading] = useState(true);

  // Check current subscription state on mount (and when auth resolves)
  useEffect(() => {
    if (!supported || authLoading) return;

    // If no session, we know we can't subscribe — stop loading immediately
    if (!session) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(!!sub);
          setPermission(Notification.permission);
        }
      } catch {
        // SW not yet available or push not supported — treat as unsubscribed
        if (!cancelled) setIsSubscribed(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void checkSubscription();
    return () => { cancelled = true; };
  }, [supported, session, authLoading]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!supported) return "denied";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !session) return false;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      return false;
    }

    setIsLoading(true);
    try {
      // 1. Ensure permission is granted — must happen before pushManager.subscribe()
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }
      if (perm !== "granted") return false;

      // 2. Get or create the push subscription
      const registration = await navigator.serviceWorker.ready;
      let pushSub = await registration.pushManager.getSubscription();

      if (!pushSub) {
        pushSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
      }

      // 3. Persist to backend
      const res = await fetch("/api/push-notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: pushSub }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to save push subscription:", error);
        // Roll back the browser-level subscription so we don't end up in a
        // half-subscribed state (browser subscribed, server doesn't know)
        await pushSub.unsubscribe();
        return false;
      }

      setIsSubscribed(true);
      setError(null);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      setError("Failed to subscribe to push notifications");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supported, session]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const pushSub = await registration.pushManager.getSubscription();

      if (pushSub) {
        // 1. Tell the server first so we don't leave a dangling subscription
        await fetch("/api/push-notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: pushSub.endpoint }),
        });

        // 2. Then revoke on the browser side
        await pushSub.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      setError("Failed to unsubscribe from push notifications");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [supported]);

  return {
    isSupported: supported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}