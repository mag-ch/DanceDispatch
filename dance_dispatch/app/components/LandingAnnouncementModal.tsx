import { getCachedEvents } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import {
  LandingAnnouncementClient,
  type AnnouncementEvent,
} from './LandingAnnouncementModalClient';
import { getSavedEventsForUserServer } from '@/lib/server_utils';

const LOOKBACK_DAYS = 7;
const INITIAL_LIMIT = 5;
const EXPANDED_LIMIT = 15;

function getOrdinalDay(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function toDayHeading(startdate: string): string {
  const [year, month, day] = startdate.split('-').map(Number);
  if (!year || !month || !day) return startdate;
  const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${monthName} ${getOrdinalDay(day)}`;
}

function getDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

function sortByDateTime<T extends { startdate: string; starttime?: string | null }>(
  a: T,
  b: T
): number {
  const aTime = new Date(`${a.startdate} ${a.starttime ?? '00:00'}`).getTime();
  const bTime = new Date(`${b.startdate} ${b.starttime ?? '00:00'}`).getTime();
  return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
}

export async function LandingAnnouncementSection() {
  const rangeStart = getDateString(LOOKBACK_DAYS);
  const rangeEnd = getDateString(0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedInRange: any[] = [];
  let savedIds = new Set<string>();
  let reviewedEventIds = new Set<string>();
if (user) {
    // 1. Fetch saved events and all events in range
    const savedEventsRaw = await getSavedEventsForUserServer(user.id, 'past');
    savedInRange = savedEventsRaw
      .filter((event) => event.startdate >= rangeStart && event.startdate <= rangeEnd)
      .sort(sortByDateTime);

    savedIds = new Set(savedInRange.map((e) => String(e.id)));

    // 2. Check which saved events already have reviews
    const { data: reviewRows } = await supabase
      .from('Reviews')
      .select('event_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'event');

    reviewedEventIds = new Set(
      (reviewRows ?? []).map((r) => String(r.event_id))
    );
  }

  const allEvents = (await getCachedEvents(false))
    .filter((event) => event.startdate >= rangeStart && event.startdate <= rangeEnd)
    .filter((event) => !savedIds.has(String(event.id)))
    .sort(sortByDateTime);

  // 3. Merge: saved first, then others
  const combined = [...savedInRange, ...allEvents];

  const events: AnnouncementEvent[] = combined.map((event) => ({
    id: String(event.id),
    title: event.title,
    subtitle: event.location || 'Unknown Venue',
    dayHeading: toDayHeading(event.startdate),
    href: user ? `/events/${event.id}?showReviewModal=true` : `/events/${event.id}`,
    startdate: event.startdate,
    isSaved: user ? savedIds.has(String(event.id)) : false,
    imageUrl: event.imageurl || undefined,
    needsReview: user
      ? savedIds.has(String(event.id)) && !reviewedEventIds.has(String(event.id))
      : false,
  }));

  if (events.length === 0) return null;

  const savedCount = savedInRange.length;
  const unreviewedCount = events.filter((e) => e.needsReview).length;

  const header = !user
    ? 'What you missed this weekend'
    : unreviewedCount > 0
    ? `You saved ${savedCount} part${savedCount === 1 ? 'y' : 'ies'} — ${unreviewedCount} waiting for your review`
    : savedCount > 0
    ? `You saved ${savedCount} part${savedCount === 1 ? 'y' : 'ies'} recently`
    : 'How were the parties? Leave a review';

  return (
    <LandingAnnouncementClient
      header={header}
      events={events}
      initialLimit={INITIAL_LIMIT}
      expandedLimit={EXPANDED_LIMIT}
      totalCount={combined.length}
      savedCount={savedCount}
      unreviewedCount={unreviewedCount}
    />
  );
}