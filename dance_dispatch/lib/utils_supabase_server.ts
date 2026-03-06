import 'server-only';

import { unstable_cache, revalidateTag } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { Event, EventReview, Host, Venue } from '@/lib/utils';

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

async function fetchCatalogFromSupabase(): Promise<CatalogData> {
  const supabase = getCacheableSupabaseClient();

  const [eventsRes, venuesRes, hostsRes, eventHostsRes] = await Promise.all([
    supabase
      .from('Events')
      .select('id,title,start,end,location,description,price,flyer_url,external_url,google_cal_id')
      .order('start', { ascending: true }),
    supabase.from('Venues').select('id,name,address,type,bio,image_url').order('name'),
    supabase.from('Hosts').select('id,name,bio,image_url,tags').order('name'),
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
    residents: row.residents ?? '',
    photourls: row.photo_urls ?? '',
  }));

  const hosts: Host[] = hostRows.map((row: any) => ({
    id: String(row.id),
    name: row.name,
    bio: row.bio ?? '',
    photoUrl: row.photo_url ?? '',
    tags: row.tags ?? '',
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
  return filtered.filter((event) => new Date(`${event.startdate} ${event.starttime}`) >= now);
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

    const venueReviews = (data ?? []).filter((row: any) => row.entity_type === 'venue');
    const hostReviews = (data ?? []).filter((row: any) => row.entity_type === 'host');
    const eventComments = (data ?? []).filter((row: any) => row.entity_type === 'event');

    const reviewsByUserAndTime = new Map<string, EventReview>();
    for (const row of [...venueReviews, ...hostReviews, ...eventComments]) {
      const key = `${row.user_id}-${row.created_at}`;
      if (!reviewsByUserAndTime.has(key)) {
        reviewsByUserAndTime.set(key, {
          eventId: String(row.event_id),
          username: row.user_id,
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
        review.venueReview = { rating: row.rating, comments: row.comment };
      } else if (row.entity_type === 'host') {
        review.djReviews?.push({
          djId: String(row.entity_id),
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

export async function userSaveEvent(eventId: string, userId: string, saveBool: boolean): Promise<string> {
  const supabase = await createServerClient();

  if (saveBool) {
    const { error } = await supabase
      .from('SavedEvents')
      .upsert({ user_id: userId, event_id: Number(eventId) }, { onConflict: 'user_id,event_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('SavedEvents')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', Number(eventId));
    if (error) throw error;
  }

  return `${userId}-${eventId}`;
}

export async function userSaveVenue(venueId: string, userId: string, saveBool: boolean): Promise<string> {
  const supabase = await createServerClient();

  if (saveBool) {
    const { error } = await supabase
      .from('UserFollowedVenues')
      .upsert({ user_id: userId, venue_id: Number(venueId) }, { onConflict: 'user_id,venue_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('UserFollowedVenues')
      .delete()
      .eq('user_id', userId)
      .eq('venue_id', Number(venueId));
    if (error) throw error;
  }

  return `${userId}-${venueId}`;
}

export async function userSaveHost(hostId: string, userId: string, saveBool: boolean): Promise<string> {
  const supabase = await createServerClient();

  if (saveBool) {
    const { error } = await supabase
      .from('UserFollowedHosts')
      .upsert({ user_id: userId, host_id: Number(hostId) }, { onConflict: 'user_id,host_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('UserFollowedHosts')
      .delete()
      .eq('user_id', userId)
      .eq('host_id', Number(hostId));
    if (error) throw error;
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
  if (updatedFields.locationid !== undefined) patch.venue_id = Number(updatedFields.locationid);
  if (updatedFields.description !== undefined) patch.description = updatedFields.description;
  if (updatedFields.price !== undefined) patch.price = updatedFields.price;
  if (updatedFields.imageurl !== undefined) patch.image_url = updatedFields.imageurl;
  if (updatedFields.externallink !== undefined) patch.external_link = updatedFields.externallink;

  const supabase = await createServerClient();
  const { error } = await supabase.from('Events').update(patch).eq('id', Number(eventId));
  if (error) {
    return null;
  }

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
