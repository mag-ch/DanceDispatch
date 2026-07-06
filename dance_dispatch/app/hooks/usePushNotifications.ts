'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

type PushState = {
  isSupported: boolean;
  isSubscribed: boolean;
  hasCheckedSubscription: boolean;
  permission: NotificationPermission | 'unsupported';
  isLoading: boolean;
  error: string | null;
};

export function usePushNotifications() {
  const { session, loading: authLoading } = useAuth();
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    hasCheckedSubscription: false,
    permission: 'unsupported',
    isLoading: false,
    error: null,
  });

  const isSupported = useMemo(
    () => typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window,
    []
  );

  const syncSubscription = useCallback(async () => {
    if (!isSupported || !session?.user?.id) {
      setState((current) => ({
        ...current,
        isSupported,
        isSubscribed: false,
        hasCheckedSubscription: true,
        permission: isSupported ? Notification.permission : 'unsupported',
        isLoading: false,
        error: null,
      }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setState((current) => ({
        ...current,
        isSupported: true,
        isSubscribed: Boolean(subscription),
        hasCheckedSubscription: true,
        permission: Notification.permission,
        error: null,
      }));

      if (subscription) {
        await fetch('/api/push-notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        isSupported: true,
        isSubscribed: false,
        hasCheckedSubscription: true,
        permission: Notification.permission,
        error: error instanceof Error ? error.message : 'Failed to load push notification state.',
      }));
    }
  }, [isSupported, session?.user?.id]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void syncSubscription();
  }, [authLoading, syncSubscription]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'dd-pushsubscriptionchange') {
        void syncSubscription();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [isSupported, syncSubscription]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !session?.user?.id) {
      return false;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!publicKey) {
      setState((current) => ({ ...current, error: 'Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.' }));
      return false;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        setState((current) => ({
          ...current,
          isLoading: false,
          permission,
          isSubscribed: false,
          error: permission === 'denied' ? 'Browser notifications are blocked.' : null,
        }));
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const response = await fetch('/api/push-notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to subscribe to push notifications.');
      }

      setState((current) => ({
        ...current,
        isLoading: false,
        isSubscribed: true,
        permission,
        error: null,
      }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        isSubscribed: false,
        permission: Notification.permission,
        error: error instanceof Error ? error.message : 'Failed to subscribe to push notifications.',
      }));
      return false;
    }
  }, [isSupported, session?.user?.id]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !session?.user?.id) {
      return false;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch('/api/push-notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }

      setState((current) => ({
        ...current,
        isLoading: false,
        isSubscribed: false,
        permission: Notification.permission,
        error: null,
      }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe from push notifications.',
      }));
      return false;
    }
  }, [isSupported, session?.user?.id]);

  const sendTestNotification = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/push-notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to send test notification.');
      }

      setState((current) => ({ ...current, isLoading: false, error: null }));
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test notification.';
      setState((current) => ({ ...current, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}