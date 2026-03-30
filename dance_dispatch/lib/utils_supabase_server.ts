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

function splitDbDateTime(value: unknown): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' };
  }

  const raw = String(value).replace('T', ' ');
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
        links.push({ url: trimmed, platform: inferPlatformFromUrl(trimmed) });
        continue;
      }

      const candidate = entry as { url?: unknown; platform?: unknown; label?: unknown };
      const url = String(candidate.url ?? '').trim();
      if (!url) continue;
      const platform = String(candidate.platform ?? '').trim() || inferPlatformFromUrl(url);
      const label = String(candidate.label ?? '').trim();

      links.push({
        url,
        platform,
        ...(label ? { label } : {}),
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
    supabase.from('Hosts').select('id,name,bio,image_url,tags,external_urls').order('name'),
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
      .from('host_links')
      .select('host_id,url,platform,label,display_order')
      .order('display_order', { ascending: true });

    if (!error && data) {
      for (const row of data) {
        const hostId = Number((row as any).host_id);
        const url = String((row as any).url ?? '').trim();
        if (Number.isNaN(hostId) || !url) continue;

        const existing = hostLinksByHostId.get(hostId) ?? [];
        const platform = String((row as any).platform ?? '').trim() || inferPlatformFromUrl(url);
        const label = String((row as any).label ?? '').trim();

        existing.push({
          url,
          platform,
          ...(label ? { label } : {}),
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
    photoUrl: row.photo_url ?? '',
    tags: row.tags ?? '',
    externalLinks:
      hostLinksByHostId.get(Number(row.id)) ?? normalizeHostLinks((row as any).external_urls),
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
      .select('id,event_id,user_id,privacy_level,created_at,entity_type,entity_id,rating,comment')
      .eq('event_id', Number(eventId))
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    //map venue name to venue id for easier consumption on client
    const venues = await getCachedVenues();
    const venueMap = new Map(venues.map((venue) => [String(venue.id), venue.name]));

    const hosts = await getCachedHosts();
    const hostMap = new Map(hosts.map((host) => [String(host.id), host.name]));

    //map event name to event reviews for easier consumption on client
    const event = await getEventById(eventId);
    const eventName = event ? event.title : 'Unknown Event';

    // map user id to username for easier consumption on client
    const userIds = Array.from(new Set((data ?? []).map((row: any) => row.user_id)));
    const users = await Promise.all(userIds.map((id) => getUserById(id)));
    const userMap = new Map(users.map((user) => [user?.id, user?.username]));

    const venueReviews = (data ?? []).filter((row: any) => row.entity_type === 'venue');
    const hostReviews = (data ?? []).filter((row: any) => row.entity_type === 'host');
    const eventComments = (data ?? []).filter((row: any) => row.entity_type === 'event');

    const reviewsByUserAndTime = new Map<string, EventReview>();
    for (const row of [...venueReviews, ...hostReviews, ...eventComments]) {
      const key = `${row.user_id}-${row.created_at}`;
      if (!reviewsByUserAndTime.has(key)) {
        reviewsByUserAndTime.set(key, {
          eventName: eventName,
          eventId: String(row.event_id),
          username: userMap.get(row.user_id) ?? row.user_id,
          dateSubmitted: row.created_at,
          mainComment: '',
          venueReview: undefined,
          djReviews: [],
          privacyLevel: row.privacy_level,
        });
      }

      const review = reviewsByUserAndTime.get(key);
      if (!review) continue;

      if (row.entity_type === 'event') {
        review.mainComment = row.comment;
      } else if (row.entity_type === 'venue') {
        review.venueReview = { venueName: venueMap.get(String(row.entity_id)) ?? 'Unknown Venue', rating: row.rating, comments: row.comment };
      } else if (row.entity_type === 'host') {
        review.djReviews?.push({
          djName: hostMap.get(String(row.entity_id)) ?? 'Unknown Host',
          rating: row.rating,
          comments: row.comment,
        });
      }
    }

    return Array.from(reviewsByUserAndTime.values());
  } catch (error) {
    console.error('Error fetching event reviews from Supabase:', error);
    return [];
  }
}


export async function getHostMedia(hostId: string): Promise<any[]> {
  try {

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('host_media')
      .select('host_id,type,embed_code')
      .eq('host_id', Number(hostId));

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
    console.error('Error checking user follow from Supabase:', error);
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
  | 'patch_notes';

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

export async function getUserNotifications(userId: string, limit = 30): Promise<UserNotification[]> {
  const supabase = await createServerClient();

  const [followedUsersRes, followedHostsRes, followedVenuesRes, allEvents, allHosts, allVenues] = await Promise.all([
    supabase
      .from('UserFollowUsers')
      .select('followed_id')
      .eq('user_id', userId),
    supabase.from('UserFollowedHosts').select('host_id').eq('user_id', userId),
    supabase.from('UserFollowedVenues').select('venue_id').eq('user_id', userId),
    getCachedEvents(false),
    getCachedHosts(),
    getCachedVenues(),
  ]);

  if (followedUsersRes.error) {
    throw followedUsersRes.error;
  }
  if (followedHostsRes.error) {
    throw followedHostsRes.error;
  }
  if (followedVenuesRes.error) {
    throw followedVenuesRes.error;
  }


  const followedUserIds = (followedUsersRes.data ?? [])
    .map((row: any) => String(row.followed_id))
    .filter((id) => id && id !== userId);
  const followedHostIds = (followedHostsRes.data ?? [])
    .map((row: any) => Number(row.host_id))
    .filter((id) => !Number.isNaN(id));
  const followedVenueIds = (followedVenuesRes.data ?? [])
    .map((row: any) => Number(row.venue_id))
    .filter((id) => !Number.isNaN(id));

  const notifications: UserNotification[] = [];
  const now = new Date();
  const eventById = new Map(allEvents.map((event) => [String(event.id), event]));
  const hostById = new Map(allHosts.map((host) => [Number(host.id), host]));
  const venueById = new Map(allVenues.map((venue) => [Number(venue.id), venue]));

  const usernameById = new Map<string, string>();
  if (followedUserIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id,username')
      .in('id', followedUserIds);

    if (!profilesError) {
      for (const profile of profilesData ?? []) {
        const username = String((profile as any).username ?? '').trim();
        const id = String((profile as any).id ?? '').trim();
        if (!id) continue;
        usernameById.set(id, username || 'A user you follow');
      }
    }
  }
  console.log('Fetched followed user profiles:', { userId, count: usernameById.size });
  const { data: sharedItemsData, error: sharedItemsError } = await supabase
    .from('SharedItems')
    .select('id,sender_id,recipient_id,entity_type,entity_id,message,created_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(75);


  if (sharedItemsError) {
    console.warn('Skipping shared item notifications:', sharedItemsError.message);
  } else if ((sharedItemsData ?? []).length > 0) {
    const profileIds = Array.from(
      new Set(
        (sharedItemsData ?? [])
          .flatMap((row: any) => {
            const ids: string[] = [];
            const senderId = String((row as any).sender_id ?? '').trim();
            const entityType = normalizeNotificationEntityType((row as any).entity_type);
            const entityId = String((row as any).entity_id ?? '').trim();

            if (senderId) ids.push(senderId);
            if (entityType === 'user' && entityId) ids.push(entityId);
            return ids;
          })
          .filter(Boolean)
      )
    );

    if (profileIds.length > 0) {
      const { data: sharedProfilesData, error: sharedProfilesError } = await supabase
        .from('profiles')
        .select('id,username,full_name')
        .in('id', profileIds);

      if (!sharedProfilesError) {
        for (const profile of sharedProfilesData ?? []) {
          const id = String((profile as any).id ?? '').trim();
          if (!id) continue;
          const username = String((profile as any).username ?? (profile as any).full_name ?? '').trim();
          usernameById.set(id, username || 'Someone');
        }
      }
    }

    for (const row of sharedItemsData ?? []) {
      const id = String((row as any).id ?? '').trim();
      const senderId = String((row as any).sender_id ?? '').trim();
      const entityId = String((row as any).entity_id ?? '').trim();
      const entityType = normalizeNotificationEntityType((row as any).entity_type);
      const message = String((row as any).message ?? '').trim();
      const createdAt = String((row as any).created_at ?? '').trim();
      const senderName = usernameById.get(senderId) ?? 'Someone';
      let href = getSharedItemHref(entityType, entityId);

      let description = message;
      if (!description && entityType === 'event') {
        const event = eventById.get(entityId);
        if (event) {
          const start = new Date(`${event.startdate} ${event.starttime}`);
          description = start < now
            ? `${event.title} is over. Click the link to leave a review.`
            : `${event.title} is coming up. Open the event page to RSVP.`;
          href = `/events/${event.id}${start < now ? '?showReviewModal=true' : ''}`;
        }
      }

      if (!description && entityType === 'host') {
        description = hostById.get(Number(entityId))?.name ?? 'Open the DJ page to see details.';
      }

      if (!description && entityType === 'venue') {
        description = venueById.get(Number(entityId))?.name ?? 'Open the venue page to see details.';
      }

      if (!description && entityType === 'user') {
        description = `${usernameById.get(entityId) ?? 'A profile'} was shared with you.`;
      }

      if (!description) {
        description = 'Open to see what was shared with you.';
      }

      notifications.push({
        id: id || `shared-${senderId}-${entityType}-${entityId}-${createdAt}`,
        type: 'shared_item',
        title: `${senderName} shared ${entityType === 'event' ? 'an event' : entityType === 'host' ? 'a DJ' : entityType === 'venue' ? 'a venue' : entityType === 'user' ? 'a profile' : 'something'} with you`,
        description,
        createdAt: createdAt || new Date().toISOString(),
        href,
      });
    }
  }

  // 1) A user you follow RSVPs to a new event
  if (followedUserIds.length > 0) {
    const { data: savedEventsData, error: savedEventsError } = await supabase
      .from('SavedEvents')
      .select('user_id,event_id,created_at')
      .in('user_id', followedUserIds)
      .order('created_at', { ascending: false })
      .limit(75);

    if (!savedEventsError) {
      for (const row of savedEventsData ?? []) {
        const eventId = String((row as any).event_id ?? '');
        const followedUserId = String((row as any).user_id ?? '');
        const createdAt = String((row as any).created_at ?? '');
        const event = eventById.get(eventId);
        if (!event) continue;

        const eventStart = new Date(`${event.startdate} ${event.starttime}`);
        if (eventStart < now) continue;

        const username = usernameById.get(followedUserId) ?? 'A user you follow';
        notifications.push({
          id: `rsvp-${followedUserId}-${eventId}-${createdAt}`,
          type: 'followed_user_rsvp',
          title: `${username} RSVP'd to a new event`,
          description: `${event.title}`,
          createdAt: createdAt || eventStartIso(event),
          href: `/events/${event.id}`,
        });
      }
    }
  }

  // 2) A user you follow comments on something
  if (followedUserIds.length > 0) {
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('Reviews')
      .select('user_id,event_id,entity_type,comment,created_at')
      .in('user_id', followedUserIds)
      .order('created_at', { ascending: false })
      .limit(75);

    if (!reviewsError) {
      for (const row of reviewsData ?? []) {
        const comment = String((row as any).comment ?? '').trim();
        if (!comment) continue;

        const followedUserId = String((row as any).user_id ?? '');
        const eventId = String((row as any).event_id ?? '');
        const entityType = String((row as any).entity_type ?? 'event');
        const createdAt = String((row as any).created_at ?? '');
        const username = usernameById.get(followedUserId) ?? 'A user you follow';
        const event = eventById.get(eventId);

        const subject =
          entityType === 'host'
            ? 'a DJ'
            : entityType === 'venue'
              ? 'a venue'
              : event?.title ?? 'an event';

        notifications.push({
          id: `comment-${followedUserId}-${eventId}-${createdAt}`,
          type: 'followed_user_comment',
          title: `${username} commented on ${subject}`,
          description: comment.length > 120 ? `${comment.slice(0, 120)}...` : comment,
          createdAt:
            createdAt ||
            (event
              ? eventStartIso(event)
              : allEvents[0]
                ? eventStartIso(allEvents[0])
                : new Date().toISOString()),
          href: event ? `/events/${event.id}` : '/search',
        });
      }
    }
  }

  // 3) A DJ you follow is listed on a new event
  if (followedHostIds.length > 0) {
    const { data: eventHostsData, error: eventHostsError } = await supabase
      .from('event_hosts')
      .select('host_id,event_id')
      .in('host_id', followedHostIds)
      .limit(200);

    if (!eventHostsError) {
      const dedupe = new Set<string>();

      for (const row of eventHostsData ?? []) {
        const hostId = Number((row as any).host_id);
        const eventId = String((row as any).event_id ?? '');
        if (Number.isNaN(hostId) || !eventId) continue;

        const dedupeKey = `${hostId}-${eventId}`;
        if (dedupe.has(dedupeKey)) continue;
        dedupe.add(dedupeKey);

        const event = eventById.get(eventId);
        if (!event) continue;

        const eventStart = new Date(`${event.startdate} ${event.starttime}`);
        if (eventStart < now) continue;

        const hostName = hostById.get(hostId)?.name ?? 'A DJ you follow';

        notifications.push({
          id: `dj-${hostId}-${eventId}`,
          type: 'followed_dj_new_event',
          title: `${hostName} is listed on a new event`,
          description: event.title,
          createdAt: eventStartIso(event),
          href: `/events/${event.id}`,
        });
      }
    }
  }
  // 4) A venue you follow is listed on a new event
  if (followedVenueIds.length > 0) {
    const { data: eventVenuesData, error: eventVenuesError } = await supabase
      .from('Events')
      .select('id, location, created_at')
      .in('location', followedVenueIds)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!eventVenuesError) {
      const dedupe = new Set<string>();


      for (const row of eventVenuesData ?? []) {
        const venueId = Number((row as any).location);
        const eventId = String((row as any).id ?? '');
        if (Number.isNaN(venueId) || !eventId) continue;



        const dedupeKey = `${venueId}-${eventId}`;
        if (dedupe.has(dedupeKey)) continue;
        dedupe.add(dedupeKey);

        const event = eventById.get(eventId);
        if (!event) continue;

        const eventStart = new Date(`${event.startdate} ${event.starttime}`);
        if (eventStart < now) continue;

        const venueName = venueById.get(venueId)?.name ?? 'A venue you follow';

        notifications.push({
          id: `venue-${venueId}-${eventId}`,
          type: 'followed_venue_new_event',
          title: `${venueName} is listed on a new event`,
          description: event.title,
          createdAt: eventStartIso(event),
          href: `/events/${event.id}`,
        });
      }
    }
  }

  //5) pull recent patch notes
  const { data: patchNotesData, error: patchNotesError } = await supabase
    .from('patch_notes')
    .select('id, description, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!patchNotesError) {
      console.log('Processing patch notes notifications:', { count: patchNotesData?.length ?? 0 });

    for (const row of patchNotesData ?? []) {

      const dedupe = new Set<string>();

      const patchId = String((row as any).id ?? '');
      if (Number.isNaN(patchId)) continue;



      const dedupeKey = `${patchId}`;
      if (dedupe.has(dedupeKey)) continue;
      dedupe.add(dedupeKey);

      notifications.push({
        id: `patch-${patchId}`,
        type: 'patch_notes',
        title: `Patch notes #${patchId}`,
        description: row.description,
        createdAt: row.created_at,
        href: `/`,
      });
    }
  }
  console.log('Total notifications before sorting and limiting:', notifications.length);
  // check the sorting of notifications
  return notifications
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, Math.max(1, limit));
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


  return 'success';
}

export async function updateEvent(eventId: string, updatedFields: Partial<Event>): Promise<string | null> {
  const patch: any = {};
  if (updatedFields.title !== undefined) patch.title = updatedFields.title;
  if (updatedFields.startdate !== undefined) patch.start_date = updatedFields.startdate;
  if (updatedFields.starttime !== undefined) patch.start_time = updatedFields.starttime;
  if (updatedFields.enddate !== undefined) patch.end_date = updatedFields.enddate;
  if (updatedFields.endtime !== undefined) patch.end_time = updatedFields.endtime;
  if (updatedFields.locationid !== undefined) patch.location = Number(updatedFields.locationid);
  if (updatedFields.description !== undefined) patch.description = updatedFields.description;
  if (updatedFields.price !== undefined) patch.price = updatedFields.price;
  if (updatedFields.imageurl !== undefined) patch.flyer_url = updatedFields.imageurl;
  if (updatedFields.externallink !== undefined) patch.external_url = updatedFields.externallink;

  const supabase = await createServerClient();
  const { error } = await supabase.from('Events').update(patch).eq('id', Number(eventId));
  if (error) {
    console.error('Error updating event:', error);
    return null;
  }

  console.log(`Event ${patch.flyer_url} updated successfully. Invalidating cache.`);
  revalidateCatalogCache();
  return eventId;
}

export async function getUsernameFromId(userId: string | number): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single<{ username: string }>();

    if (error) {
      console.error('Error fetching username:', error.message);
      return null;
    }

    return data?.username ?? null;
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
