import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { geocodeAddress } from '@/lib/geocoding';

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

export type VenueCoordinates = { lat: number; lng: number };

// Caps how many geocoding requests run at once so a slow/unreachable geocoder
// can't turn a page load into dozens of sequential multi-second waits.
const GEOCODE_CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function getVenueCoordinates(
  venueId: string,
  address: string
): Promise<VenueCoordinates | null> {
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

  // Cache the geocoded coordinates so future lookups skip the geocoding API call.
  const { error: updateError } = await supabase
    .from('Venues')
    .update({ latitude: geocoded.lat, longitude: geocoded.lng })
    .eq('id', Number(venueId));

  if (updateError) {
    console.error('Failed to cache geocoded venue coordinates:', updateError);
  }

  return geocoded;
}

// Reads only already-cached coordinates (no geocoding network calls), so callers that
// need an instant response (e.g. initial page render) aren't blocked on a slow geocoder.
export async function getCachedVenueCoordinatesOnly(
  venueIds: string[]
): Promise<Map<string, VenueCoordinates>> {
  const result = new Map<string, VenueCoordinates>();
  const numericIds = venueIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id));
  if (numericIds.length === 0) {
    return result;
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('Venues')
    .select('id,latitude,longitude')
    .in('id', numericIds);

  if (error) {
    console.error('Failed to load cached venue coordinates:', error);
    return result;
  }

  for (const row of data ?? []) {
    if (typeof (row as any).latitude === 'number' && typeof (row as any).longitude === 'number') {
      result.set(String((row as any).id), { lat: (row as any).latitude, lng: (row as any).longitude });
    }
  }

  return result;
}

// Resolves coordinates for many venues at once, batching the cached lookup and
// geocoding only the venues that are missing coordinates.
export async function getVenueCoordinatesBatch(
  venues: { id: string; address: string }[]
): Promise<Map<string, VenueCoordinates>> {
  const result = new Map<string, VenueCoordinates>();
  if (venues.length === 0) {
    return result;
  }

  const supabase = getServiceRoleClient();
  const numericIds = venues.map((venue) => Number(venue.id)).filter((id) => !Number.isNaN(id));

  const { data, error } = await supabase
    .from('Venues')
    .select('id,latitude,longitude')
    .in('id', numericIds);

  if (error) {
    console.error('Failed to batch-load venue coordinates:', error);
  }

  const cachedById = new Map(
    (data ?? [])
      .filter((row: any) => typeof row.latitude === 'number' && typeof row.longitude === 'number')
      .map((row: any) => [String(row.id), { lat: row.latitude, lng: row.longitude }])
  );

  const uncachedVenues = venues.filter((venue) => !cachedById.has(venue.id) && venue.address);

  for (const [venueId, coordinates] of cachedById) {
    result.set(venueId, coordinates);
  }

  await mapWithConcurrency(uncachedVenues, GEOCODE_CONCURRENCY, async (venue) => {
    const geocoded = await geocodeAddress(venue.address);
    if (!geocoded) return;

    result.set(venue.id, geocoded);

    const { error: updateError } = await supabase
      .from('Venues')
      .update({ latitude: geocoded.lat, longitude: geocoded.lng })
      .eq('id', Number(venue.id));

    if (updateError) {
      console.error('Failed to cache geocoded venue coordinates:', updateError);
    }
  });

  return result;
}

