'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';

// Re-check location periodically while enabled so an in-progress RSVP'ed event can be confirmed.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export const LOCATION_PROMPT_KEY_PREFIX = 'dd_location_checkin_response_v1';
export const LOCATION_ENABLED_EVENT = 'dd-location-enabled';

export type LocationConfirmation = { eventId: string; eventTitle: string };

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (geoError) => reject(new Error(geoError.message || 'Unable to read device location.')),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }
    );
  });
}

type LocationCheckInState = {
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
};

export function useLocationCheckIn(
  enabled: boolean,
  onConfirmed?: (confirmations: LocationConfirmation[]) => void
) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<LocationCheckInState>({
    isSupported: typeof window !== 'undefined' && 'geolocation' in navigator,
    isLoading: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;

  const reportPosition = useCallback(async (): Promise<void> => {
    if (!userId || !state.isSupported) return;

    const position = await getPosition();
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

    const payload = await response.json().catch(() => null);
    const confirmations: LocationConfirmation[] = Array.isArray(payload?.confirmations) ? payload.confirmations : [];
    if (confirmations.length > 0) onConfirmedRef.current?.(confirmations);
  }, [userId, state.isSupported]);

  const requestEnable = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !userId) {
      return false;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      await getPosition();
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
  }, [state.isSupported, userId]);

  useEffect(() => {
    if (!enabled || !userId || !state.isSupported) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const run = () => {
      reportPosition().catch((error) => {
        console.error('Location check-in failed:', error);
      });
    };
    run();
    intervalRef.current = setInterval(run, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, userId, state.isSupported, reportPosition]);

  return { ...state, requestEnable };
}
