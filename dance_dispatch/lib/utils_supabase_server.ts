import 'server-only';

import { unstable_cache, revalidateTag } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { Event, EventReview, Host, HostExternalLink, Venue } from '@/lib/utils';
import { getBoroughFromAddress } from '@/lib/utils';
import { ChessBishopIcon } from 'lucide-react';

type CatalogData = {
  events: Event[];
  hosts: Host[];
  venues: Venue[];
};

let cacheableSupabaseClient: SupabaseClient | null = null;

function getCacheableSupabaseClient(): SupabaseClient {
  if (cacheableSupabaseClient) {
    return cacheableSupabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase env vars for cached catalog client');
  }

  cacheableSupabaseClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cacheableSupabaseClient;
}

function getServiceRoleSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function splitDbDateTime(value: unknown): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' };
  }

  const rawValue = String(value).trim();

  const raw = rawValue.replace('T', ' ');
  const [datePart = '', timeWithZone = ''] = raw.split(' ');
  const timeNoMs = timeWithZone.split('.')[0] ?? '';
  const timePart = timeNoMs.split('+')[0]?.split('-')[0]?.replace('Z', '') ?? '';
  return { date: datePart, time: timePart };
}

function inferPlatformFromUrl(url: string): string {
  const normalized = url.toLowerCase();
  if (normalized.includes('soundcloud.com')) return 'soundcloud';
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube';
  if (normalized.includes('spotify.com')) return 'spotify';
  if (normalized.includes('instagram.com')) return 'instagram';
  if (normalized.includes('mixcloud.com')) return 'mixcloud';
  return 'website';
}

function normalizeHostLinks(value: unknown): HostExternalLink[] {
  if (Array.isArray(value)) {
    const links: HostExternalLink[] = [];

    for (const entry of value) {
      if (!entry) continue;

      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) continue;
        links.push({ url: trimmed, type: inferPlatformFromUrl(trimmed) });
        continue;
      }

      const candidate = entry as { url?: unknown; type?: unknown; embed_code?: unknown };
      const url = String(candidate.url ?? '').trim();
      if (!url) continue;
      const type = String(candidate.type ?? '').trim() || inferPlatformFromUrl(url);
      const embed_code = String(candidate.embed_code ?? '').trim();

      links.push({
        url,
        type,
        embed_code,
      });
    }

    return links;
  }

  const raw = String(value ?? '').trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeHostLinks(parsed);
    }
  } catch {
    // Fallback to plain parsing below
  }

  if (raw.startsWith('[') && raw.endsWith(']')) {
    const matches = Array.from(raw.matchAll(/'([^']+)'|"([^"]+)"/g))
      .map((match) => (match[1] ?? match[2] ?? '').trim())
      .filter(Boolean);

    if (matches.length > 0) {
      return matches.map((url) => ({ url, platform: inferPlatformFromUrl(url) }));
    }
  }

  const separator = raw.includes('|') ? '|' : ',';
  return raw
    .split(separator)
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .map((url) => ({ url, platform: inferPlatformFromUrl(url) }));
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  const raw = String(value ?? '').trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeStringList(parsed);
    }
  } catch {
    // Fall through to delimiter-based parsing
  }

  if (raw.startsWith('[') && raw.endsWith(']')) {
    const matches = Array.from(raw.matchAll(/'([^']+)'|"([^"]+)"/g))
      .map((match) => (match[1] ?? match[2] ?? '').trim())
      .filter(Boolean);

    if (matches.length > 0) {
      return matches;
    }
  }

  const separator = raw.includes('|') ? '|' : ',';
  return raw
    .split(separator)
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export async function getRelatedEvents(eventId: string): Promise<Event[]> {
  // get events similar in date and location to the current event
  const allEvents = await getCachedEvents(false);
  const currentEvent = allEvents.find((event) => event.id === eventId);
  const loc = currentEvent ? getBoroughFromAddress(currentEvent.location) : null;
  if (!currentEvent) {
    return [];
  }

  const currentEventDate = new Date(`${currentEvent.startdate} ${currentEvent.starttime}`);
  const related = allEvents
    .filter((event) => event.id !== eventId)
    .map((event) => {
      const eventDate = new Date(`${event.startdate} ${event.starttime}`);
      const dateDiff = Math.abs(eventDate.getTime() - currentEventDate.getTime());
      const locationMatch = getBoroughFromAddress(event.location) === loc;
      return { event, score: dateDiff + (locationMatch ? 0 : 1000) };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(({ event }) => event);

  return related;
}

async function fetchCatalogFromSupabase(): Promise<CatalogData> {
  const supabase = getCacheableSupabaseClient();

  const [eventsRes, venuesRes, hostsRes, eventHostsRes] = await Promise.all([
    supabase
      .from('Events')
      .select('id,title,start,end,location,description,price,flyer_url,external_url,google_cal_id')
      .order('start', { ascending: true }),
    supabase.from('Venues').select('id,name,address,type,bio,image_url,external_url').order('name'),
    supabase.from('Hosts').select('id,name,bio,image_url,tags,genres').order('name'),
    supabase.from('event_hosts').select('event_id,host_id'),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (venuesRes.error) throw venuesRes.error;
  if (hostsRes.error) throw hostsRes.error;
  if (eventHostsRes.error) throw eventHostsRes.error;

  const venueRows = venuesRes.data ?? [];
  const hostRows = hostsRes.data ?? [];
  const eventRows = eventsRes.data ?? [];
  const eventHostRows = eventHostsRes.data ?? [];

  const hostLinksByHostId = new Map<number, HostExternalLink[]>();
  try {
    const { data, error } = await supabase
      .from('host_media')
      .select('host_id,embed_code,type,link');

    if (!error && data) {
      for (const row of data) {
        const hostId = Number((row as any).host_id);
        const url = String((row as any).link ?? '').trim();
        if (Number.isNaN(hostId) || !url) continue;

        const existing = hostLinksByHostId.get(hostId) ?? [];
        const embed_code = String((row as any).embed_code ?? '').trim();
        const label = String((row as any).type ?? '').trim() || inferPlatformFromUrl(url);

        existing.push({
          type: label,
          embed_code,
          url,
        });
        hostLinksByHostId.set(hostId, existing);
      }
    }
  } catch {
    // Optional table; keep host links empty when unavailable.
  }

  const venueNameById = new Map<number, string>(
    venueRows
      .map((row: any) => [Number(row.id), row.name] as const)
      .filter(([id]) => !Number.isNaN(id))
  );

  const hostNameById = new Map<number, string>(
    hostRows
      .map((row: any) => [Number(row.id), row.name] as const)
      .filter(([id]) => !Number.isNaN(id))
  );

  const hostGenresById = new Map<number, string[]>(
    hostRows
      .map((row: any) => [Number(row.id), normalizeStringList(row.genres)] as const)
      .filter(([id]) => !Number.isNaN(id))
  );

  const hostIdsByEventId = new Map<number, number[]>();
  for (const row of eventHostRows) {
    const eventId = Number((row as any).event_id);
    const hostId = Number((row as any).host_id);

    if (Number.isNaN(eventId) || Number.isNaN(hostId)) continue;

    const existing = hostIdsByEventId.get(eventId) ?? [];
    existing.push(hostId);
    hostIdsByEventId.set(eventId, existing);
  }

  const events: Event[] = eventRows.map((row: any) => {
    const { date: startdate, time: starttime } = splitDbDateTime(row.start);
    const { date: enddate, time: endtime } = splitDbDateTime(row.end);
    const numericLocationId = Number(row.location);
    const mappedHostIds = hostIdsByEventId.get(Number(row.id)) ?? [];
    const hostGenres = Array.from(
      new Set(
        mappedHostIds.flatMap((id) => hostGenresById.get(id) ?? [])
      )
    );

    return {
      id: String(row.id),
      title: row.title ?? '',
      startdate,
      starttime,
      enddate,
      endtime,
      locationid: Number.isNaN(numericLocationId) ? '' : String(numericLocationId),
      location: venueNameById.get(numericLocationId) ?? 'Unknown Location',
      description: row.description ?? '',
      price:
        row.price === null || row.price === undefined || Number.isNaN(Number(row.price))
          ? undefined
          : Number(row.price),
      imageurl: row.flyer_url ?? undefined,
      externallink: row.external_url ?? undefined,
      hostIDs: mappedHostIds.map((id) => String(id)),
      hostNames: mappedHostIds.map((id) => hostNameById.get(id) ?? 'Unknown Host'),
      hostGenres,
    };
  });

  const venues: Venue[] = venueRows.map((row: any) => ({
    id: String(row.id),
    name: row.name,
    address: row.address ?? '',
    type: row.type ?? '',
    bio: row.bio ?? '',
    website: row.external_url ?? '',
    photourls: row.image_url ?? '',
  }));

  const hosts: Host[] = hostRows.map((row: any) => ({
    id: String(row.id),
    name: row.name,
    bio: row.bio ?? '',
    photoUrl: row.image_url ?? '',
    tags: normalizeStringList(row.tags),
    genre: normalizeStringList(row.genre),
  }));

  return { events, hosts, venues };
}

const getCachedCatalogInternal = unstable_cache(fetchCatalogFromSupabase, ['supabase-catalog-v1'], {
  revalidate: 300,
  tags: ['catalog', 'events', 'hosts', 'venues'],
});

export async function getCachedCatalog(): Promise<CatalogData> {
  return getCachedCatalogInternal();
}

export async function getCachedEvents(
  onlyUpcoming = true,
  venueId?: string | number,
  hostId?: string | number
): Promise<Event[]> {
  const { events } = await getCachedCatalog();

  let filtered = events;

  if (venueId) {
    filtered = filtered.filter((event) => event.locationid === venueId.toString());
  }

  if (hostId) {
    filtered = filtered.filter((event) => event.hostIDs?.some((id) => id === hostId.toString()));
  }

  if (!onlyUpcoming) {
    return filtered;
  }

  const now = new Date();
  return filtered.filter((event) => new Date(`${event.enddate} ${event.endtime}`) >= now);
}

export async function getCachedHosts(): Promise<Host[]> {
  const { hosts } = await getCachedCatalog();
  return hosts;
}

export async function getCachedVenues(): Promise<Venue[]> {
  const { venues } = await getCachedCatalog();
  return venues;
}

export function revalidateCatalogCache(): void {
  revalidateTag('catalog', 'max');
  revalidateTag('events', 'max');
  revalidateTag('hosts', 'max');
  revalidateTag('venues', 'max');
}

export async function getEvents(
  onlyUpcoming = true,
  venueId?: string | number,
  hostId?: string | number,
  forceRefresh = false
): Promise<Event[]> {
  if (forceRefresh) {
    revalidateCatalogCache();
  }
  return getCachedEvents(onlyUpcoming, venueId, hostId);
}

export async function getEventById(eventId: string): Promise<Event | null> {
  const events = await getCachedEvents(false);
  return events.find((event) => event.id === eventId) ?? null;
}

export async function getEventReviews(eventId: string): Promise<EventReview[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('Reviews')
      .select('id, event_id, user_id, privacy_level, created_at, entity_type, entity_id, rating, comment, ReviewMedia(storage_path)')
      .eq('event_id', Number(eventId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    const venues = await getCachedVenues();
    const venueMap = new Map(venues.map((venue) => [String(venue.id), venue.name]));

    const hosts = await getCachedHosts();
    const hostMap = new Map(hosts.map((host) => [String(host.id), host.name]));

    const event = await getEventById(eventId);
    const eventName = event ? event.title : 'Unknown Event';

    const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id)));
    const users = await Promise.all(userIds.map((id) => getUserById(id)));
    const userMap = new Map(users.map((user) => [user?.id, user?.username]));

    // Group rows by user + 1-minute bucket
    // Floor created_at to the nearest minute so rows submitted within
    // the same 60-second window share the same key.
    const getGroupKey = (row: any): string => {
      const ms = new Date(row.created_at).getTime();
      const minuteBucket = Math.floor(ms / 60_000); // unix minute
      return `${row.user_id}-${minuteBucket}`;
    };

    const reviewsByKey = new Map<string, EventReview>();

    const rows = data ?? [];
    // Process event comments first so mainComment + mediaPaths are set
    // before venue/host rows potentially create the group entry
    const ordered = [
      ...rows.filter((r: any) => r.entity_type === 'event'),
      ...rows.filter((r: any) => r.entity_type === 'venue'),
      ...rows.filter((r: any) => r.entity_type === 'host'),
    ];

    for (const row of ordered) {
      const key = getGroupKey(row);
      const mediaPaths: string[] = (row.ReviewMedia ?? []).map((m: any) => m.storage_path);

      if (!reviewsByKey.has(key)) {
        reviewsByKey.set(key, {
          eventName,
          eventId: String(row.event_id),
          username: row.privacy_level === 'anonymous' ? 'Anonymous' : (userMap.get(row.user_id) ?? row.user_id),
          dateSubmitted: row.created_at,
          privacyLevel: row.privacy_level,
          mainComment: '',
          mediaPaths: [],
          venueReview: undefined,
          djReviews: [],
        });
      }

      const review = reviewsByKey.get(key)!;

      if (row.entity_type === 'event') {
        review.mainComment = row.comment;
        // Media is attached to the event-level review row
        review.mediaPaths = mediaPaths;
      } else if (row.entity_type === 'venue') {
        review.venueReview = {
          venueName: venueMap.get(String(row.entity_id)) ?? 'Unknown Venue',
          rating: row.rating,
          comments: row.comment,
        };
      } else if (row.entity_type === 'host') {
        review.djReviews?.push({
          djName: hostMap.get(String(row.entity_id)) ?? 'Unknown Host',
          rating: row.rating,
          comments: row.comment,
        });
      }
    }

    return Array.from(reviewsByKey.values());
  } catch (error) {
    console.error('Error fetching event reviews from Supabase:', error);
    return [];
  }
}


export async function getUserReviews(userId: string): Promise<EventReview[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('Reviews')
      .select('id, event_id, user_id, privacy_level, created_at, entity_type, entity_id, rating, comment, ReviewMedia(storage_path)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const venues = await getCachedVenues();
    const venueMap = new Map(venues.map((venue) => [String(venue.id), venue.name]));

    const hosts = await getCachedHosts();
    const hostMap = new Map(hosts.map((host) => [String(host.id), host.name]));

    const events = await getCachedEvents(false);
    const eventMap = new Map(events.map((event) => [String(event.id), event.title]));

    // Group rows by user + 1-minute bucket
    // Floor created_at to the nearest minute so rows submitted within
    // the same 60-second window share the same key.
    const getGroupKey = (row: any): string => {
      const ms = new Date(row.created_at).getTime();
      const minuteBucket = Math.floor(ms / 60_000); // unix minute
      return `${row.user_id}-${minuteBucket}`;
    };

    const reviewsByKey = new Map<string, EventReview>();

    const rows = data ?? [];
    // Process event comments first so mainComment + mediaPaths are set
    // before venue/host rows potentially create the group entry
    const ordered = [
      ...rows.filter((r: any) => r.entity_type === 'event'),
      ...rows.filter((r: any) => r.entity_type === 'venue'),
      ...rows.filter((r: any) => r.entity_type === 'host'),
    ];

    for (const row of ordered) {
      const key = getGroupKey(row);
      const mediaPaths: string[] = (row.ReviewMedia ?? []).map((m: any) => m.storage_path);
      const username = await getUserById(userId);
      if (!reviewsByKey.has(key)) {
        reviewsByKey.set(key, {
          eventName: eventMap.get(String(row.event_id))??"Unknown Event",
          eventId: String(row.event_id),
          userId: row.user_id,
          username: username.username,
          dateSubmitted: row.created_at,
          privacyLevel: row.privacy_level,
          mainComment: '',
          mediaPaths: [],
          venueReview: undefined,
          djReviews: [],
        });
      }

      const review = reviewsByKey.get(key)!;

      if (row.entity_type === 'event') {
        review.mainComment = row.comment;
        // Media is attached to the event-level review row
        review.mediaPaths = mediaPaths;
      } else if (row.entity_type === 'venue') {
        review.venueReview = {
          venueName: venueMap.get(String(row.entity_id)) ?? 'Unknown Venue',
          rating: row.rating,
          comments: row.comment,
        };
      } else if (row.entity_type === 'host') {
        review.djReviews?.push({
          djName: hostMap.get(String(row.entity_id)) ?? 'Unknown Host',
          rating: row.rating,
          comments: row.comment,
        });
      }
    }

    return Array.from(reviewsByKey.values());
  } catch (error) {
    console.error('Error fetching event reviews from Supabase:', error);
    return [];
  }
}

export async function getHostPreviousEventReviews(hostId: string, eventId: string | number): Promise<Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; comment: string }>>> {
  try {
    const supabase = await createServerClient();
    // Get all events hosted by this host
    const events = await getCachedEvents(false);
    const hostEventIds = events
      .filter((event) => event.hostIDs?.some((id) => id === hostId))
      .map((event) => Number(event.id));

    if (hostEventIds.length === 0) {
      return new Map();
    }

    // Fetch reviews for these events where entity_type='host' and entity_id=hostId
    const { data, error } = await supabase
      .from('Reviews')
      .select('event_id, user_id, privacy_level, rating, comment')
      .in('event_id', hostEventIds)
      .eq('entity_type', 'host')
      .eq('entity_id', Number(hostId))
      .neq('event_id', Number(eventId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    const allEvents = await getCachedEvents(false);
    const eventMap = new Map(allEvents.map((event) => [String(event.id), event.title]));

    const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id)));
    const users = await Promise.all(userIds.map((id) => getUserById(id)));
    const userMap = new Map(users.map((user) => [user?.id, user?.username]));

    const reviewsByEventId = new Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; comment: string }>>();
    const rows = data ?? [];
    
    for (const row of rows) {
      const eventId = String(row.event_id);
      if (!reviewsByEventId.has(eventId)) {
        reviewsByEventId.set(eventId, []);
      }
      
      const eventReviews = reviewsByEventId.get(eventId)!;
      if (eventReviews.length < 3) {
        eventReviews.push({
          eventId,
          eventName: eventMap.get(eventId) ?? 'Unknown Event',
          username: row.privacy_level === 'anonymous' ? 'Anonymous' : (userMap.get(row.user_id) ?? row.user_id),
          rating: row.rating || 0,
          comment: row.comment || '',
        });
      }
    }

    return reviewsByEventId;
  } catch (error) {
    console.error('Error fetching host previous event reviews from Supabase:', error);
    return new Map();
  }
}

export async function getVenuePreviousEventReviews(venueId: string | number, eventId: string | number): Promise<Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; comment: string }>>> {
  try {
    const supabase = await createServerClient();
    const normalizedVenueId = Number(venueId);

    if (!normalizedVenueId) {
      return new Map();
    }

    const events = await getCachedEvents(false);
    const venueEventIds = events
      .filter((event) => String(event.locationid) === String(normalizedVenueId))
      .map((event) => Number(event.id));

    if (venueEventIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('Reviews')
      .select('event_id, user_id, privacy_level, rating, comment')
      .in('event_id', venueEventIds)
      .eq('entity_type', 'venue')
      .eq('entity_id', normalizedVenueId)
      .neq('event_id', Number(eventId))
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id)));
    const users = await Promise.all(userIds.map((id) => getUserById(id)));
    const userMap = new Map(users.map((user) => [user?.id, user?.username]));

    const reviewsByEventId = new Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; comment: string }>>();
    const rows = data ?? [];

    const allEvents = await getCachedEvents(false);
    const eventMap = new Map(allEvents.map((event) => [String(event.id), event.title]));
    
    for (const row of rows) {
      const eventId = String(row.event_id);
      if (!reviewsByEventId.has(eventId)) {
        reviewsByEventId.set(eventId, []);
      }
      
      const eventReviews = reviewsByEventId.get(eventId)!;
      if (eventReviews.length < 3) {
        eventReviews.push({
          eventId,
          eventName: eventMap.get(eventId) ?? 'Unknown Event',
          username: row.privacy_level === 'anonymous' ? 'Anonymous' : (userMap.get(row.user_id) ?? row.user_id),
          rating: row.rating || 0,
          comment: row.comment || '',
        });
      }
    }

    return reviewsByEventId;
  } catch (error) {
    console.error('Error fetching previous venue event reviews from Supabase:', error);
    return new Map();
  }
}

export async function createHost(data: {
  name: string;
  tags?: string | null;
}): Promise<any> {
  const supabase = await createServerClient();

  const { data: newHost, error } = await supabase
    .from('Hosts')
    .insert([
      {
        name: data.name,
        tags: data.tags || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating host:', error);
    throw new Error(`Failed to create host: ${error.message}`);
  }

  return newHost;
}

export async function getHostMedia(hostId: string): Promise<any[]> {
  try {

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('host_media')
      .select('id,host_id,type,link,embed_code')
      .eq('host_id', Number(hostId))
      .order('id', { ascending: false });

    if (error) {
      throw error;
    }
    return data ?? [];
  } catch (error) {
    console.error('Error fetching host media from Supabase:', error);
    return [];
  }
}

export async function getEventsFromSupabase(
  onlyUpcoming = true,
  venueId?: string | number,
  hostId?: string | number
): Promise<Event[]> {
  return getCachedEvents(onlyUpcoming, venueId, hostId);
}

export async function getVenues(): Promise<Venue[]> {
  return getCachedVenues();
}

export async function getHosts(): Promise<Host[]> {
  return getCachedHosts();
}

export async function getUsers(): Promise<any[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('profiles').select('id,full_name,username,profile_picture,created_at');
  if (error) throw error;
  return data ?? [];
}

export async function checkUserFollow(userId: string, targetUserId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('UserFollowUsers')
    .select('*')
    .eq('user_id', userId)
    .eq('followed_id', targetUserId)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

export async function getUserById(userId: string): Promise<any | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.from('profiles').select('id,full_name,username,profile_picture,created_at').eq('id', userId).single();
  if (error) {
    console.error(`Error fetching user with ID ${userId}:`, error);
    return null;
  }
  return data ?? null;
}

export async function userSaveEvent(eventId: string, userId: string, saveBool: boolean): Promise<string> {
  const supabase = await createServerClient();
  const numericEventId = Number(eventId);

  if (Number.isNaN(numericEventId)) {
    throw new Error('Invalid event id');
  }

  if (saveBool) {
    const { data: existingRow, error: existingError } = await supabase
      .from('SavedEvents')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', numericEventId)
      .maybeSingle();
    if (existingError) throw existingError;


    if (!existingRow) {
      const { error } = await supabase
        .from('SavedEvents')
        .insert({ user_id: userId, event_id: numericEventId });

      if (error) throw error;
    }
  } else {
    const { error } = await supabase
      .from('SavedEvents')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', numericEventId);
    if (error) throw error;
  }

  return `${userId}-${eventId}`;
}

export async function userSaveVenue(venueId: string, userId: string, saveBool: boolean): Promise<string> {
  const supabase = await createServerClient();

  if (saveBool) {
    const { error } = await supabase
      .from('UserFollowedVenues')
      .insert({ user_id: userId, venue_id: venueId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('UserFollowedVenues')
      .delete()
      .eq('user_id', userId)
      .eq('venue_id', venueId);
    if (error) throw error;
  }

  return `${userId}-${venueId}`;
}

export async function userSaveHost(hostId: string, userId: string, saveBool: boolean): Promise<string> {
  const supabase = await createServerClient();


  if (saveBool) {
    const { error } = await supabase
      .from('UserFollowedHosts')
      .insert({ host_id: hostId, user_id: userId });
    if (error) {
      console.error('Error saving user follow:', error);
      throw new Error('Failed to save user follow');
    }
  } else {
    const { error } = await supabase
      .from('UserFollowedHosts')
      .delete()
      .eq('user_id', userId)
      .eq('host_id', hostId);
    if (error) {
      console.error('Error unsaving user follow:', error);
      throw new Error('Failed to unsave user follow');
    }
  }
  return `${userId}-${hostId}`;
}

export async function getAllFollowedVenues(userId: string): Promise<Venue[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('UserFollowedVenues').select('venue_id').eq('user_id', userId);
  if (error) throw error;
  const followedIds = new Set((data ?? []).map((row: any) => String(row.venue_id)));
  const venues = await getCachedVenues();
  return venues.filter((venue) => followedIds.has(String(venue.id)));
}

export async function getAllFollowedHosts(userId: string): Promise<Host[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('UserFollowedHosts').select('host_id').eq('user_id', userId);

  if (error) throw error;

  const followedIds = new Set((data ?? []).map((row: any) => String(row.host_id)));
  const hosts = await getCachedHosts();
  return hosts.filter((host) => followedIds.has(String(host.id)));
}


export async function getAllFollowedUsers(userId: string): Promise<any[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('UserFollowUsers').select('followed_id').eq('user_id', userId);

  if (error) throw error;

  const followedIds = new Set((data ?? []).map((row: any) => String(row.followed_id)));

  const users = await getUsers();
  return users.filter((user) => followedIds.has(String(user.id)));
}

export type NotificationType =
  | 'shared_item'
  | 'followed_user_rsvp'
  | 'followed_user_comment'
  | 'followed_dj_new_event'
  | 'followed_venue_new_event'
  | 'patch_notes'
  | 'new_user_missions';

export type UserNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  href: string;
};

function toMillis(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function eventStartIso(event: Event): string {
  return `${event.startdate}T${event.starttime}`;
}

function normalizeNotificationEntityType(value: string | undefined): 'event' | 'host' | 'venue' | 'user' | 'unknown' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'event' || normalized === 'events') return 'event';
  if (normalized === 'host' || normalized === 'hosts') return 'host';
  if (normalized === 'venue' || normalized === 'venues') return 'venue';
  if (normalized === 'user' || normalized === 'users') return 'user';
  return 'unknown';
}

function getSharedItemHref(entityType: string, entityId: string): string {
  const normalized = normalizeNotificationEntityType(entityType);
  if (normalized === 'event') return `/events/${entityId}?showReviewModal=true`;
  if (normalized === 'host') return `/hosts/${entityId}`;
  if (normalized === 'venue') return `/venues/${entityId}`;
  if (normalized === 'user') return `/users/${entityId}`;
  return '/search';
}

export async function userSubmitReview(reviewData: any, userId: string, eventId: string): Promise<string> {
  const supabase = await createServerClient();
  const { data: parent, error: parentErr } = await supabase
    .from('Reviews')
    .insert({
      event_id: Number(eventId),
      user_id: userId,
      privacy_level: reviewData.privacyLevel ?? 'public',
      entity_type: reviewData.entityType ?? 'event',
      entity_id: reviewData.entityId ? Number(reviewData.entityId) : null,
      rating: reviewData.rating ? Number(reviewData.rating) : null,
      comment: reviewData.comment ?? '',
    })
    .select('id')
    .single();

  if (parentErr) throw parentErr;

  // Insert media paths if provided
  const mediaPaths: string[] = reviewData.mediaPaths ?? [];
  if (mediaPaths.length > 0) {
    const { error: mediaErr } = await supabase
      .from('ReviewMedia')
      .insert(
    
        mediaPaths.map((path) => ({
          review_id: parent.id,
          storage_path: path,
        }))
      );

    if (mediaErr) throw mediaErr;
  }

  return 'success';
}

export async function updateEvent(
  eventId: string,
  updatedFields: Partial<Event> & {
    start?: string;
    end?: string;
    location?: string;
    newVenueName?: string;
    newVenueAddress?: string;
  }
): Promise<string | null> {
  const patch: any = {};
  const supabase = await createServerClient();
  const normalizeTime = (value: string) => (value.length === 5 ? `${value}:00` : value);

  const normalizeDateTimeInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (!trimmed.includes('T')) {
      return trimmed;
    }

    const [datePart = '', rawTimePart = ''] = trimmed.split('T');
    const timeNoMs = rawTimePart.split('.')[0] ?? '';
    const timePart = timeNoMs.split('+')[0]?.split('-')[0]?.replace('Z', '') ?? '';
    if (!datePart || !timePart) {
      return trimmed;
    }

    return `${datePart}T${normalizeTime(timePart)}`;
  };

  if (updatedFields.start && typeof updatedFields.start === 'string') {
    const normalizedStart = normalizeDateTimeInput(updatedFields.start);
    if (normalizedStart) {
      patch.start = normalizedStart;
    }
  }

  if (updatedFields.end && typeof updatedFields.end === 'string') {
    const normalizedEnd = normalizeDateTimeInput(updatedFields.end);
    if (normalizedEnd) {
      patch.end = normalizedEnd;
    }
  }

  if (!patch.start && updatedFields.startdate && updatedFields.starttime) {
    patch.start = `${updatedFields.startdate}T${normalizeTime(updatedFields.starttime)}`;
  }

  if (!patch.end && updatedFields.enddate && updatedFields.endtime) {
    patch.end = `${updatedFields.enddate}T${normalizeTime(updatedFields.endtime)}`;
  }

  if (updatedFields.title !== undefined) patch.title = updatedFields.title;
  if (updatedFields.locationid !== undefined) patch.location = Number(updatedFields.locationid);
  else if (updatedFields.location !== undefined) {
    const trimmedLocation = updatedFields.location.trim();
    if (trimmedLocation) {
      const numericLocation = Number(trimmedLocation);
      if (!Number.isNaN(numericLocation)) {
        patch.location = numericLocation;
      } else {
        const { data: existingVenue, error: venueLookupError } = await supabase
          .from('Venues')
          .select('id')
          .ilike('name', trimmedLocation)
          .limit(1)
          .maybeSingle();

        if (venueLookupError) {
          throw venueLookupError;
        }

        if (existingVenue) {
          patch.location = Number(existingVenue.id);
        } else {
          const { data: createdVenue, error: createVenueError } = await supabase
            .from('Venues')
            .insert({
              name: trimmedLocation,
              address: updatedFields.newVenueAddress?.trim() ?? '',
              type: 'Venue',
              bio: '',
              image_url: '',
              external_url: '',
            })
            .select('id')
            .single();

          if (createVenueError) {
            throw createVenueError;
          }

          patch.location = Number(createdVenue.id);
        }
      }
    }
  }
  if (updatedFields.description !== undefined) patch.description = updatedFields.description;
  if (updatedFields.price !== undefined) patch.price = updatedFields.price;
  if (updatedFields.imageurl !== undefined) patch.flyer_url = updatedFields.imageurl;
  if (updatedFields.externallink !== undefined) patch.external_url = updatedFields.externallink;

  const { error } = await supabase.from('Events').update(patch).eq('id', Number(eventId));
  if (error) {
    console.error('Error updating event:', error);
    return null;
  }

  console.log(`Event ${eventId} updated successfully. Invalidating cache.`);
  revalidateCatalogCache();
  return eventId;
}

export type DeleteEventOptions = {
  useServiceRole?: boolean;
};

export async function deleteEvent(eventId: string, options: DeleteEventOptions = {}): Promise<boolean> {
  const numericEventId = Number(eventId);
  if (Number.isNaN(numericEventId)) {
    throw new Error('Invalid event id');
  }

  const serviceRoleClient = options.useServiceRole ? getServiceRoleSupabaseClient() : null;
  if (options.useServiceRole && !serviceRoleClient) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for deleteEvent useServiceRole mode');
  }

  const supabase = serviceRoleClient ?? await createServerClient();

  const existingEventResult = await supabase
    .from('Events')
    .select('id,google_cal_id,title')
    .eq('id', numericEventId)
    .limit(1);

  if (existingEventResult.error) {
    console.error('deleteEvent: failed to check existing event row', {
      eventId: numericEventId,
      message: existingEventResult.error.message,
      code: existingEventResult.error.code,
      details: existingEventResult.error.details,
      hint: existingEventResult.error.hint,
    });
    throw new Error(existingEventResult.error.message || 'Failed to verify event before delete');
  }

  const existingRows = existingEventResult.data ?? [];

  const deleteEventHostsResult = await supabase
    .from('event_hosts')
    .delete({ count: 'exact' })
    .eq('event_id', numericEventId);
  if (deleteEventHostsResult.error) {
    console.error('Error deleting event hosts:', deleteEventHostsResult.error);
    throw new Error(deleteEventHostsResult.error.message || 'Failed to delete event hosts');
  }

  const deleteEventResult = await supabase
    .from('Events')
    .delete({ count: 'exact' })
    .eq('id', numericEventId)
    .select('id');
  if (deleteEventResult.error) {
    console.error('Error deleting event:', deleteEventResult.error);
    throw new Error(deleteEventResult.error.message || 'Failed to delete event');
  }

  const deleted = (deleteEventResult.count ?? 0) > 0 || (deleteEventResult.data || []).length > 0;
  if (deleted) {
    revalidateCatalogCache();
  } else {
    console.warn('deleteEvent: no rows deleted', {
      eventId: numericEventId,
      preDeleteMatches: existingRows.length,
      hint: existingRows.length > 0
        ? 'Row existed before delete but delete affected 0 rows; verify policies/triggers'
        : 'No matching Events row found before delete; event_id may be stale',
    });
  }

  return deleted;
}

export interface SubmitEventInput {
  title: string;
  startdate: string;   // YYYY-MM-DD
  starttime: string;   // HH:MM:SS
  enddate: string;   // YYYY-MM-DD
  endtime: string;     // HH:MM:SS
  locationid?: string;
  newVenueName?: string;
  newVenueAddress?: string;
  description?: string;
  price?: number;
  imageurl?: string;
  externallink?: string;
  createdBy?: string;
}

export async function submitEvent(input: SubmitEventInput): Promise<{ id: string } | { duplicate: true; id: string }> {
  const supabase = await createServerClient();
  let resolvedLocationId = input.locationid;

  const normalizeTime = (time: string) => (time.length === 5 ? `${time}:00` : time);
  const startTime = normalizeTime(input.starttime);
  const endTime = normalizeTime(input.endtime);

  const toSeconds = (time: string) => {
    const [hours, minutes, seconds] = time.split(':').map((part) => Number(part));
    return (hours * 3600) + (minutes * 60) + (seconds || 0);
  };


  const trimmedVenueName = input.newVenueName?.trim();
  const trimmedVenueAddress = input.newVenueAddress?.trim();

  if (trimmedVenueName || trimmedVenueAddress) {
    if (!trimmedVenueName || !trimmedVenueAddress) {
      throw new Error('Both new venue name and address are required');
    }

    const { data: existingVenue, error: existingVenueError } = await supabase
      .from('Venues')
      .select('id')
      .ilike('name', trimmedVenueName)
      .ilike('address', trimmedVenueAddress)
      .limit(1)
      .maybeSingle();

    if (existingVenueError) {
      console.error('Error checking for duplicate venue:', existingVenueError);
      throw new Error('Failed to check for duplicate venue');
    }

    if (existingVenue) {
      resolvedLocationId = String(existingVenue.id);
    } else {
      const { data: createdVenue, error: createVenueError } = await supabase
        .from('Venues')
        .insert({
          name: trimmedVenueName,
          address: trimmedVenueAddress,
          type: 'Venue',
          bio: '',
          image_url: '',
          external_url: '',
        })
        .select('id')
        .single();

      if (createVenueError) {
        console.error('Error creating venue:', createVenueError);
        throw new Error('Failed to create venue');
      }

      resolvedLocationId = String(createdVenue.id);
    }
  }

  // Duplicate check: same title + same start date (case-insensitive)
  const { data: existing, error: checkError } = await supabase
    .from('Events')
    .select('id')
    .ilike('title', input.title.trim())
    .eq('start', input.startdate)
    .limit(1)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking for duplicate event:', checkError);
    throw new Error('Failed to check for duplicate events');
  }

  if (existing) {
    return { duplicate: true, id: String(existing.id) };
  }

  const row: Record<string, unknown> = {
    title: input.title.trim(),
    start: input.startdate + 'T' + startTime,
    end: input.enddate + 'T' + endTime,
  };
  if (resolvedLocationId !== undefined) row.location = Number(resolvedLocationId);
  if (input.description !== undefined) row.description = input.description;
  if (input.price !== undefined) row.price = input.price;
  if (input.imageurl !== undefined) row.flyer_url = input.imageurl;
  if (input.externallink !== undefined) row.external_url = input.externallink;

  const { data, error } = await supabase.from('Events').insert(row).select('id').single();
  if (error) {
    console.error('Error inserting event:', error);
    throw new Error('Failed to insert event');
  }

  const newEventId = String(data.id);
  const pendingPayload = {
    event_id: Number(newEventId),
    created_by: input.createdBy ?? null,
    exclude: false,
  };

  console.info('Attempting pending_events insert for manual submit', {
    eventId: newEventId,
    createdBy: input.createdBy ?? null,
    payloadKeys: Object.keys(pendingPayload),
  });

  const pendingInsertResult = await supabase.from('pending_events').insert(pendingPayload);
  if (pendingInsertResult.error) {
    const pendingConflictCheck = await supabase
      .from('pending_events')
      .select('google_cal_id,event_id,exclude,created_by')
      .eq('event_id', Number(newEventId))
      .limit(5);

    console.warn('Failed to insert pending event for manual submit', {
      eventId: newEventId,
      createdBy: input.createdBy ?? null,
      errorMessage: pendingInsertResult.error.message,
      errorCode: pendingInsertResult.error.code,
      errorDetails: pendingInsertResult.error.details,
      errorHint: pendingInsertResult.error.hint,
      payload: pendingPayload,
      existingRowsError: pendingConflictCheck.error?.message || null,
      existingRows: pendingConflictCheck.data || [],
    });
  }

  revalidateCatalogCache();
  return { id: newEventId };
}

export async function addHostsToEvent(eventId: string, hostIds: string[]): Promise<string[]> {
  const numericEventId = Number(eventId);
  if (Number.isNaN(numericEventId)) {
    throw new Error('Invalid event id');
  }

  const normalizedHostIds = Array.from(
    new Set(
      hostIds
        .map((hostId) => Number(hostId))
        .filter((hostId) => !Number.isNaN(hostId))
    )
  );

  if (normalizedHostIds.length === 0) {
    throw new Error('Invalid host ids');
  }

  const supabase = await createServerClient();
  const { data: currentRows, error: currentError } = await supabase
    .from('event_hosts')
    .select('host_id')
    .eq('event_id', numericEventId);

  if (currentError) {
    console.error('Error loading current event hosts:', currentError);
    throw currentError;
  }

  const existingHostIds = new Set(
    (currentRows ?? [])
      .map((row: { host_id: unknown }) => Number(row.host_id))
      .filter((hostId) => !Number.isNaN(hostId))
  );

  const hostIdsToInsert = normalizedHostIds.filter((hostId) => !existingHostIds.has(hostId));

  if (hostIdsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('event_hosts').insert(
      hostIdsToInsert.map((hostId) => ({
        event_id: numericEventId,
        host_id: hostId,
      }))
    );

    if (insertError) {
      console.error('Error adding event hosts:', insertError);
      throw insertError;
    }
  }

  revalidateCatalogCache();
  return normalizedHostIds.map(String);
}

export async function setHostsForEvent(eventId: string, hostIds: string[]): Promise<string[]> {
  const numericEventId = Number(eventId);
  if (Number.isNaN(numericEventId)) {
    throw new Error('Invalid event id');
  }

  const normalizedHostIds = Array.from(
    new Set(
      hostIds
        .map((hostId) => Number(hostId))
        .filter((hostId) => !Number.isNaN(hostId))
        .map((hostId) => String(hostId))
    )
  );

  const supabase = await createServerClient();
  const { data: currentRows, error: currentError } = await supabase
    .from('event_hosts')
    .select('host_id')
    .eq('event_id', numericEventId);

  if (currentError) {
    console.error('Error loading current event hosts:', currentError);
    throw currentError;
  }

  const currentHostIdsRaw = (currentRows ?? [])
    .map((row: { host_id: unknown }) => row.host_id)
    .filter((hostId) => hostId !== null && hostId !== undefined);
  const currentHostIds = currentHostIdsRaw.map((hostId) => String(hostId));

  const toAdd = normalizedHostIds.filter((hostId) => !currentHostIds.includes(hostId));
  const toRemoveRaw = currentHostIdsRaw.filter((hostId) => !normalizedHostIds.includes(String(hostId)));

  if (toAdd.length > 0) {
    const { error: addError } = await supabase.from('event_hosts').insert(
      toAdd.map((hostId) => ({
        event_id: numericEventId,
        host_id: Number(hostId),
      }))
    );

    if (addError) {
      console.error('Error adding event hosts:', addError);
      throw addError;
    }
  }

  if (toRemoveRaw.length > 0) {
    for (const hostId of toRemoveRaw) {
      const { data: removedRows, error: removeError } = await supabase
        .from('event_hosts')
        .delete()
        .eq('event_id', numericEventId)
        .eq('host_id', hostId)
        .select('host_id');

      if (removeError) {
        console.error('Error removing event host:', { numericEventId, hostId, removeError });
        throw removeError;
      }

      if (!removedRows || removedRows.length === 0) {
        console.warn('Host delete affected 0 rows; possible RLS or type mismatch', {
          eventId: numericEventId,
          hostId,
        });
      }
    }
  }

  revalidateCatalogCache();
  return normalizedHostIds;
}

export async function getUsernameFromId(userId: string | number): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching username:', error.message);
      return null;
    }

    const row = data as { username?: string } | null;
    return row?.username ?? null;
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error instanceof Error ? error.message : String(error));
    return null;
  }
}


export async function getPatchNoteFromId(id: string | number): Promise<any | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('patch_notes')
      .select('description, created_at, href')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching patch note:', error.message);
      return null;
    }

    const row = data as { description?: string; created_at?: string; href?: string } | null;
    return row;
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function getUniqueBoroughs(): Promise<string[]> {
  const venues = await getVenues();
  const boroughs = new Set<string>();

  venues.forEach((venue) => {
    const parts = venue.address.split(',');
    if (parts.length >= 2) {
      const borough = parts[1].trim();
      boroughs.add(borough);
    }
  });

  return Array.from(boroughs).sort();
}

export async function getHostById(hostId: string): Promise<Host | null> {
  const hosts = await getCachedHosts();
  return hosts.find((host) => host.id === hostId) ?? null;
}

export async function checkHostSaved(hostId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('UserFollowedHosts')
    .select('id')
    .eq('user_id', userId)
    .eq('host_id', Number(hostId))
    .maybeSingle();

  if (error) {
    console.error('Error checking saved host:', error);
    return false;
  }

  return !!data;
}


export async function checkVenueSaved(venueId: string, userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('UserFollowedVenues')
    .select('id')
    .eq('user_id', userId)
    .eq('venue_id', Number(venueId))
    .maybeSingle();

  if (error) {
    console.error('Error checking saved venue:', error);
    return false;
  }

  return !!data;
}

export type NewUserMissionsStatus = {
  savedEvent: boolean;
  followedHost: boolean;
  wroteReview: boolean;
  followedVenue: boolean;
  followedUser: boolean;
  allComplete: boolean;
  userCreatedAt: string;
};

export async function checkNewUserMissions(userId: string): Promise<NewUserMissionsStatus> {
  const supabase = await createServerClient();

  const [savedEventRes, followedHostRes, reviewRes, profileRes, savedVenueRes, followedUserRes] = await Promise.all([
    supabase
      .from('SavedEvents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('UserFollowedHosts')
      .select('host_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('Reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single(),
    supabase
      .from('UserFollowedVenues')
      .select('venue_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .single(),
    supabase
      .from('UserFollowUsers')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);
  

  const savedEvent = (savedEventRes.count ?? 0) > 0;
  const followedHost = (followedHostRes.count ?? 0) > 0;
  const wroteReview = (reviewRes.count ?? 0) > 0;
  const followedVenue = (savedVenueRes.count ?? 0) > 0;
  const followedUser = (followedUserRes.count ?? 0) > 0;
  const allComplete = savedEvent && followedHost && wroteReview && followedVenue && followedUser;
  const userCreatedAt = (profileRes.data as any)?.created_at ?? new Date().toISOString();

  return { savedEvent, followedHost, wroteReview, followedVenue, followedUser, allComplete, userCreatedAt };
}
