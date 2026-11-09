import { createClient } from "@/lib/supabase/server";
import { getCachedEvents, getCachedHosts, getCachedVenues } from "@/lib/utils_supabase_server";
import { isUpcoming } from "@/lib/date-utils";
import { buildFollowedEventActivity } from "@/lib/followed-event-activity";
import { isBeforeEventStart } from "@/lib/date-utils";
import type { EventReview } from "@/lib/utils";

export type RecentActivityItem = {
  id: string;
  type: 'review' | 'comment' | 'rsvp' | 'new_event';
  // Creation time for individual activity; event start for grouped follow cards.
  createdAt: string;
  title: string;
  subtitle?: string;
  href: string;
  actorName?: string;
  actorAvatar?: string;
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  venueName?: string;
  imageUrl?: string;
  excerpt?: string;
  parentReview?: EventReview;
  chips?: string[];
  nextLabel?: string;
  nextDate?: string;
  nextHref?: string;
  // Set on "From your follows" cards, which group events by venue/host.
  entityKind?: 'venue' | 'host';
  entityEvents?: { id: string; title: string; date: string; href: string; imageUrl?: string }[];
  moreCount?: number;
};

export type ActivitySections = {
  friendsGoing: RecentActivityItem[];
  fromFollows: RecentActivityItem[];
  followedEvents: RecentActivityItem[];
  reviewsAndComments: RecentActivityItem[];
};

const WINDOW_DAYS = 30;
const SECTION_LIMIT = 50;

function localDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eventStartIso(event: { startdate: string; starttime?: string | null }): string {
  return `${event.startdate.split('T')[0]}T${event.starttime || '00:00:00'}`;
}

function uniqueIds(rows: any[] | null | undefined, key: string): string[] {
  return [...new Set((rows ?? []).map((row) => String(row[key] ?? '')).filter(Boolean))];
}

export async function getRecentActivitySections(viewerUserId?: string, includeFollowedEvents = false): Promise<ActivitySections> {
  const supabase = await createClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowEndDate = localDateString(windowEnd);

  const [events, venues, hosts] = await Promise.all([
    getCachedEvents(false),
    getCachedVenues(),
    getCachedHosts(),
  ]);
  const eventById = new Map(events.map((event: any) => [String(event.id), event]));
  const venueById = new Map(venues.map((venue: any) => [String(venue.id), venue]));
  const hostById = new Map(hosts.map((host: any) => [String(host.id), host]));
  const upcomingEvents = events
    .filter((event: any) => isUpcoming(event, now))
    .sort((a: any, b: any) => eventStartIso(a).localeCompare(eventStartIso(b)));

  // Next event from the event's first host, falling back to its venue.
  const buildCardDetails = (event: any) => {
    const details: Partial<RecentActivityItem> = {
      eventTitle: event?.title,
      imageUrl: event?.imageurl || undefined,
      venueName: event?.location,
      eventDate: event ? eventStartIso(event) : undefined,
      chips: (event?.hostGenres ?? []).slice(0, 3),
    };
    if (!event) return details;

    const organizerIndex = (event.hostTypes ?? []).indexOf('Organizer');
    const organizerId = organizerIndex >= 0 ? event.hostIDs?.[organizerIndex] : undefined;
    let next: any;
    let label: string | undefined;
    if (organizerId) {
      next = upcomingEvents.find(
        (e: any) => e.id !== event.id && e.hostIDs?.includes(organizerId) && eventStartIso(e) > eventStartIso(event)
      ) ?? upcomingEvents.find((e: any) => e.id !== event.id && e.hostIDs?.includes(organizerId));
      label = event.hostNames?.[organizerIndex];
    }
    if (!next && event.locationid) {
      next = upcomingEvents.find((e: any) => e.id !== event.id && e.locationid === event.locationid);
      label = event.location;
    }
    if (next) {
      details.nextLabel = label;
      details.nextDate = eventStartIso(next);
      details.nextHref = `/events/${next.id}`;
    }
    return details;
  };

  const [reviewsResult, repliesResult] = await Promise.all([
    supabase
      .from('Reviews')
      .select('id, user_id, event_id, comment, privacy_level, created_at')
      .eq('entity_type', 'event')
      .neq('privacy_level', 'private')
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(SECTION_LIMIT),
    supabase
      .from('review_replies')
      .select('id, review_id, comment, user_id, created_at')
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(SECTION_LIMIT),
  ]);
  if (reviewsResult.error) console.error('Failed to fetch recent reviews:', reviewsResult.error);
  if (repliesResult.error) console.error('Failed to fetch recent comments:', repliesResult.error);

  const reviewRows = reviewsResult.data ?? [];
  const replyRows = repliesResult.data ?? [];

  // Comments inherit the privacy and event of the review they reply to.
  const reviewIdsForReplies = uniqueIds(replyRows, 'review_id');
  const parentReviewById = new Map<string, any>();
  if (reviewIdsForReplies.length > 0) {
    const { data: parentReviews, error } = await supabase
      .from('Reviews')
      .select('id, event_id, user_id, privacy_level, created_at, entity_type, entity_id, rating, comment, ReviewMedia(storage_path)')
      .in('id', reviewIdsForReplies)
      .neq('privacy_level', 'private');
    if (error) console.error('Failed to fetch reviews for comments:', error);
    (parentReviews ?? []).forEach((row: any) => parentReviewById.set(String(row.id), row));
  }

  let followedUserIds: string[] = [];
  let followedVenueIds: string[] = [];
  let followedHostIds: string[] = [];
  let savedRows: any[] = [];

  if (viewerUserId) {
    const [usersResult, venuesResult, hostsResult] = await Promise.all([
      supabase.from('UserFollowUsers').select('followed_id').eq('user_id', viewerUserId),
      supabase.from('UserFollowedVenues').select('venue_id').eq('user_id', viewerUserId),
      supabase.from('UserFollowedHosts').select('host_id').eq('user_id', viewerUserId),
    ]);
    if (usersResult.error) console.error('Failed to fetch followed users for activity feed:', usersResult.error);
    if (venuesResult.error) console.error('Failed to fetch followed venues for activity feed:', venuesResult.error);
    if (hostsResult.error) console.error('Failed to fetch followed hosts for activity feed:', hostsResult.error);
    followedUserIds = uniqueIds(usersResult.data, 'followed_id');
    followedVenueIds = uniqueIds(venuesResult.data, 'venue_id');
    followedHostIds = uniqueIds(hostsResult.data, 'host_id');
  }

  if (followedUserIds.length > 0) {
    const { data, error } = await supabase
      .from('SavedEvents')
      .select('id, user_id, event_id, created_at')
      .in('user_id', followedUserIds)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('Failed to fetch friend RSVPs:', error);
    savedRows = data ?? [];
  }

  const profileIds = [
    ...new Set([
      ...reviewRows.map((row: any) => String(row.user_id)),
      ...replyRows.map((row: any) => String(row.user_id)),
      ...[...parentReviewById.values()].filter((row) => row.privacy_level !== 'anonymous').map((row) => String(row.user_id)),
      ...savedRows.map((row: any) => String(row.user_id)),
    ]),
  ].filter(Boolean);
  const usernameById = new Map<string, string>();
  const avatarById = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, profile_picture')
      .in('id', profileIds);
    if (error) console.error('Failed to fetch profile names for activity feed:', error);
    (profiles ?? []).forEach((profile: any) => {
      usernameById.set(String(profile.id), String(profile.username || profile.full_name || 'Someone'));
      const picture = String(profile.profile_picture ?? '');
      if (/^(https?:\/\/|\/)/.test(picture)) avatarById.set(String(profile.id), picture);
    });
  }

  const formatDay = (event: { startdate: string }) =>
    new Date(`${event.startdate.split('T')[0]}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  const friendsGoing: RecentActivityItem[] = [];
  for (const row of savedRows) {
    const event: any = eventById.get(String(row.event_id));
    if (!event || !isUpcoming(event, now) || event.startdate.split('T')[0] > windowEndDate) continue;

    const actor = usernameById.get(String(row.user_id)) ?? 'A friend';
    friendsGoing.push({
      id: `rsvp-${row.id}`,
      type: 'rsvp',
      createdAt: String(row.created_at ?? ''),
      title: `${actor} is going`,
      href: `/events/${event.id}`,
      actorName: actor,
      actorAvatar: avatarById.get(String(row.user_id)),
      ...buildCardDetails(event),
    });
  }

  const followedVenueSet = new Set(followedVenueIds);
  const followedHostSet = new Set(followedHostIds);
  const matchedEvents = includeFollowedEvents ? upcomingEvents.filter((event) =>
    event.startdate.split('T')[0] <= windowEndDate &&
    (followedVenueSet.has(String(event.locationid)) ||
      (event.hostIDs ?? []).some((id: string) => followedHostSet.has(String(id))))
  ) : [];
  const createdAtById = new Map<string, string>();
  for (let offset = 0; offset < matchedEvents.length; offset += 200) {
    const ids = matchedEvents.slice(offset, offset + 200).map((event) => event.id);
    const { data, error } = await supabase.from('Events').select('id, created_at').in('id', ids);
    if (error) {
      console.error('Failed to fetch creation dates for followed events:', error);
      continue;
    }
    for (const row of data ?? []) {
      if (row.created_at) createdAtById.set(String(row.id), String(row.created_at));
    }
  }
  const followedEvents = buildFollowedEventActivity(matchedEvents, followedVenueIds, followedHostIds, createdAtById);
  const MAX_EVENTS_PER_ENTITY = 3;

  // One card per followed venue/host, listing its upcoming events in the window.
  const eventsByEntity = new Map<string, { kind: 'venue' | 'host'; id: string; events: any[] }>();
  const addToEntity = (kind: 'venue' | 'host', id: string, event: any) => {
    const key = `${kind}-${id}`;
    const entry = eventsByEntity.get(key) ?? { kind, id, events: [] };
    entry.events.push(event);
    eventsByEntity.set(key, entry);
  };
  for (const event of upcomingEvents as any[]) {
    if (event.startdate.split('T')[0] > windowEndDate) continue;
    const venueId = String(event.locationid ?? '');
    if (followedVenueSet.has(venueId)) addToEntity('venue', venueId, event);
    for (const hostId of (event.hostIDs ?? []).map(String)) {
      if (followedHostSet.has(hostId)) addToEntity('host', hostId, event);
    }
  }

  const fromFollows: RecentActivityItem[] = [];
  for (const { kind, id, events: entityEvents } of eventsByEntity.values()) {
    const entity: any = kind === 'venue' ? venueById.get(id) : hostById.get(id);
    const entityName = entity?.name ?? (kind === 'venue' ? 'A venue you follow' : 'A host you follow');
    const entityImage = kind === 'venue' ? entity?.photourls : entity?.photoUrl;
    const entityHref = `/${kind === 'venue' ? 'venues' : 'hosts'}/${id}`;

    fromFollows.push({
      id: `follow-${kind}-${id}`,
      type: 'new_event',
      createdAt: eventStartIso(entityEvents[0]),
      title: entityName,
      href: entityHref,
      actorName: entityName,
      actorAvatar: /^(https?:\/\/|\/)/.test(String(entityImage ?? '')) ? String(entityImage) : undefined,
      entityKind: kind,
      moreCount: Math.max(0, entityEvents.length - MAX_EVENTS_PER_ENTITY),
      entityEvents: entityEvents.slice(0, MAX_EVENTS_PER_ENTITY).map((event) => ({
        id: String(event.id),
        title: String(event.title ?? 'Upcoming event'),
        date: eventStartIso(event),
        href: `/events/${event.id}`,
        imageUrl: event.imageurl || undefined,
      })),
    });
  }

  const reviewsAndComments: RecentActivityItem[] = [];
  for (const row of reviewRows) {
    const event: any = eventById.get(String(row.event_id));
    const anonymous = row.privacy_level === 'anonymous';
    const actor = anonymous ? 'Anonymous' : (usernameById.get(String(row.user_id)) ?? 'Someone');
    reviewsAndComments.push({
      id: `review-${row.id}`,
      type: 'review',
      createdAt: String(row.created_at ?? ''),
      title: `${actor} left a review`,
      href: event?.id ? `/events/${event.id}` : '/search',
      actorName: actor,
      actorAvatar: anonymous ? undefined : avatarById.get(String(row.user_id)),
      excerpt: String(row.comment ?? '').trim() || undefined,
      ...buildCardDetails(event),
    });
  }
  for (const row of replyRows) {
    const parent = parentReviewById.get(String(row.review_id));
    if (!parent) continue;
    const event: any = eventById.get(String(parent.event_id));
    const actor = usernameById.get(String(row.user_id)) ?? 'Someone';
    const parentReview: EventReview = {
      id: String(parent.id),
      eventId: String(parent.event_id),
      eventName: event?.title ?? 'Unknown Event',
      eventImageUrl: event?.imageurl || undefined,
      userId: parent.user_id,
      username: parent.privacy_level === 'anonymous' ? 'Anonymous' : (usernameById.get(String(parent.user_id)) ?? 'Someone'),
      dateSubmitted: parent.created_at,
      isPreEvent: event ? isBeforeEventStart(event, parent.created_at) : false,
      privacyLevel: parent.privacy_level,
      mainComment: parent.entity_type === 'event' ? parent.comment : undefined,
      rating: parent.entity_type === 'event' ? Number(parent.rating) || 0 : undefined,
      mediaPaths: parent.entity_type === 'event' ? (parent.ReviewMedia ?? []).map((media: { storage_path: string }) => media.storage_path) : [],
      venueReview: parent.entity_type === 'venue' ? {
        venueId: String(parent.entity_id),
        venueName: venueById.get(String(parent.entity_id))?.name ?? 'Unknown Venue',
        rating: parent.rating,
        comments: parent.comment,
      } : undefined,
      djReviews: parent.entity_type === 'host' ? [{
        djId: String(parent.entity_id),
        djName: hostById.get(String(parent.entity_id))?.name ?? 'Unknown Host',
        rating: parent.rating,
        comments: parent.comment,
      }] : [],
    };
    reviewsAndComments.push({
      id: `comment-${row.id}`,
      type: 'comment',
      createdAt: String(row.created_at ?? ''),
      title: `${actor} left a comment`,
      href: event?.id ? `/events/${event.id}` : '/search',
      actorName: actor,
      actorAvatar: avatarById.get(String(row.user_id)),
      excerpt: String(row.comment ?? '').trim() || undefined,
      parentReview,
      ...buildCardDetails(event),
    });
  }

  const byDate = (a: RecentActivityItem, b: RecentActivityItem) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  const valid = (item: RecentActivityItem) => !Number.isNaN(Date.parse(item.createdAt));

  return {
    friendsGoing: friendsGoing.filter(valid).sort((a, b) => byDate(b, a)),
    fromFollows: fromFollows.filter(valid).sort(byDate),
    followedEvents: followedEvents.sort((a, b) => byDate(b, a)),
    reviewsAndComments: reviewsAndComments.filter(valid).sort((a, b) => byDate(b, a)),
  };
}
