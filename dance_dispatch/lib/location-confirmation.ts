import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getCachedEvents, getCachedVenues } from '@/lib/utils_supabase_server';
import { geocodeAddress } from '@/lib/geocoding';
import { sendPushToUser } from '@/lib/push-notifications';
import type { Event } from '@/lib/utils';

const LOCATION_CONFIRMATIONS_TABLE = 'location_confirmations';
// A user must be within this radius of the venue to be considered "at" the event.
const CONFIRMATION_RADIUS_METERS = 200;
// Small grace window so arriving slightly early/late still counts as within the event timeframe.
const EVENT_WINDOW_GRACE_MINUTES = 15;

let serviceRoleClient: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  serviceRoleClient = createSupabaseClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return serviceRoleClient;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getEventWindow(event: Event): { start: Date; end: Date } {
  const start = new Date(`${event.startdate}T${event.starttime}`);
  const end = new Date(`${event.enddate}T${event.endtime}`);
  const graceMs = EVENT_WINDOW_GRACE_MINUTES * 60 * 1000;

  return { start: new Date(start.getTime() - graceMs), end: new Date(end.getTime() + graceMs) };
}

async function getVenueCoordinates(
  venueId: string,
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('Venues')
    .select('latitude,longitude')
    .eq('id', Number(venueId))
    .maybeSingle();

  if (error) {
    console.error('Failed to load venue coordinates:', error);
  }

  if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
    return { lat: data.latitude, lng: data.longitude };
  }

  const geocoded = await geocodeAddress(address);
  if (!geocoded) {
    return null;
  }

  // Cache the geocoded coordinates so future checks skip the geocoding API call.
  const { error: updateError } = await supabase
    .from('Venues')
    .update({ latitude: geocoded.lat, longitude: geocoded.lng })
    .eq('id', Number(venueId));

  if (updateError) {
    console.error('Failed to cache geocoded venue coordinates:', updateError);
  }

  return geocoded;
}

export type LocationConfirmationResult = {
  eventId: string;
  eventTitle: string;
};

export async function confirmUserLocationForActiveEvents(
  userId: string,
  latitude: number,
  longitude: number
): Promise<LocationConfirmationResult[]> {
  const supabase = await createServerClient();

  const { data: savedRows, error: savedError } = await supabase
    .from('SavedEvents')
    .select('event_id')
    .eq('user_id', userId);

  if (savedError) {
    throw new Error(savedError.message || 'Failed to load RSVPed events');
  }

  const savedEventIds = new Set((savedRows ?? []).map((row: any) => String(row.event_id)));
  if (savedEventIds.size === 0) {
    return [];
  }

  const now = new Date();
  const [allEvents, venues] = await Promise.all([getCachedEvents(false), getCachedVenues()]);
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));

  const activeRsvpedEvents = allEvents.filter((event) => {
    if (!savedEventIds.has(event.id)) return false;
    const { start, end } = getEventWindow(event);
    return now >= start && now <= end;
  });

  if (activeRsvpedEvents.length === 0) {
    return [];
  }

  const serviceSupabase = getServiceRoleClient();
  const { data: existingConfirmations, error: existingError } = await serviceSupabase
    .from(LOCATION_CONFIRMATIONS_TABLE)
    .select('event_id')
    .eq('user_id', userId)
    .in('event_id', activeRsvpedEvents.map((event) => Number(event.id)));

  if (existingError) {
    throw new Error(existingError.message || 'Failed to load existing location confirmations');
  }

  const alreadyConfirmedEventIds = new Set(
    (existingConfirmations ?? []).map((row: any) => String(row.event_id))
  );

  const results: LocationConfirmationResult[] = [];

  for (const event of activeRsvpedEvents) {
    if (alreadyConfirmedEventIds.has(event.id)) continue;

    const venue = venueById.get(event.locationid);
    if (!venue?.address) continue;

    const coordinates = await getVenueCoordinates(venue.id, venue.address);
    if (!coordinates) continue;

    const distance = distanceInMeters(latitude, longitude, coordinates.lat, coordinates.lng);
    if (distance > CONFIRMATION_RADIUS_METERS) continue;

    const { error: insertError } = await serviceSupabase.from(LOCATION_CONFIRMATIONS_TABLE).insert({
      user_id: userId,
      event_id: Number(event.id),
      latitude,
      longitude,
      distance_meters: Math.round(distance),
    });

    if (insertError) {
      // Unique constraint violation means another request already confirmed this event; skip notifying twice.
      if (insertError.code !== '23505') {
        console.error('Failed to record location confirmation:', insertError);
      }
      continue;
    }

    await sendPushToUser(userId, {
      title: "You're checked in!",
      body: `Location confirmed at ${event.title}. Have fun!`,
      href: `/events/${event.id}`,
      tag: `location-confirmation-${event.id}`,
    }).catch((error) => {
      console.error('Failed to send location confirmation push:', error);
    });

    results.push({ eventId: event.id, eventTitle: event.title });
  }

  return results;
}
