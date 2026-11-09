import type { Event } from './utils';
import type { RecentActivityItem } from './recent-activity';

export function buildFollowedEventActivity(
  events: Event[],
  followedVenueIds: string[],
  followedHostIds: string[],
  createdAtById: ReadonlyMap<string, string>,
): RecentActivityItem[] {
  const venues = new Set(followedVenueIds);
  const hosts = new Set(followedHostIds);
  const seen = new Set<string>();
  const items: RecentActivityItem[] = [];

  for (const event of events) {
    if (seen.has(event.id)) continue;
    const followedNames = [
      ...(venues.has(event.locationid) && event.location ? [event.location] : []),
      ...(event.hostIDs ?? []).flatMap((id, index) =>
        hosts.has(id) && event.hostNames?.[index] ? [event.hostNames[index]] : []),
    ];
    if (!venues.has(event.locationid) && !(event.hostIDs ?? []).some((id) => hosts.has(id))) continue;
    const createdAt = createdAtById.get(event.id);
    if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
      console.error(`Missing or invalid creation date for followed event ${event.id}`);
      continue;
    }
    seen.add(event.id);
    const names = [...new Set(followedNames)];
    items.push({
      id: `follow-event-${event.id}`,
      type: 'new_event',
      createdAt,
      title: names.length ? `From your follows: ${names.join(', ')}` : 'From your follows',
      actorName: names.length ? names.join(', ') : 'Your follows',
      href: `/events/${event.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: `${event.startdate.split('T')[0]}T${event.starttime || '00:00:00'}`,
      venueName: event.location,
      imageUrl: event.imageurl,
    });
  }
  return items;
}
