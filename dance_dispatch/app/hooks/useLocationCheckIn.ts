'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';

// Re-check location periodically while enabled so an in-progress RSVP'ed event can be confirmed.
const CHECK_INTERVAL_MS = 1 * 60 * 1000;

type LocationCheckInState = {
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
};

export function useLocationCheckIn(enabled: boolean) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<LocationCheckInState>({
    isSupported: typeof window !== 'undefined' && 'geolocation' in navigator,
    isLoading: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reportPosition = useCallback((): Promise<void> => {
    if (!userId || !state.isSupported) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch('/api/location-check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            });

            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to check location.');
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        },
        (geoError) => {
          reject(new Error(geoError.message || 'Unable to read device location.'));
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }
      );
    });
  }, [userId, state.isSupported]);

  const requestEnable = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !userId) {
      return false;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      await reportPosition();
      setState((current) => ({ ...current, isLoading: false }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to enable location check-in.',
      }));
      return false;
    }
  }, [state.isSupported, userId, reportPosition]);

  useEffect(() => {
    if (!enabled || !userId || !state.isSupported) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      reportPosition().catch((error) => {
        console.error('Location check-in failed:', error);
      });
    }, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, userId, state.isSupported, reportPosition]);

  return { ...state, requestEnable };
}
