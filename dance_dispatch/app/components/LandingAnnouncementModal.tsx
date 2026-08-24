import { getCachedEvents } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import {
  LandingAnnouncementClient,
  type AnnouncementEvent,
} from './LandingAnnouncementModalClient';
import { getSavedEventsForUserServer } from '@/lib/server_utils';
import type { Event } from '@/lib/utils';

const LOOKBACK_DAYS = 4;
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
  const now = new Date();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Helper: combine date + time into a Date object for comparison
  const toDateTime = (date: string, time: string) => new Date(`${date}T${time}`);

  // Helper: check if event has ended
  const hasEnded = (event: Event) => {
    const endDateTime = toDateTime(event.enddate, event.endtime);
    return endDateTime < now;
  };

  // 1. Fetch saved events and all events in range
  const savedEventsRaw = await getSavedEventsForUserServer(user.id, 'past');
  const savedInRange = savedEventsRaw
    .filter((event) => event.startdate >= rangeStart && event.startdate <= rangeEnd)
    .filter(hasEnded) // Only show events that have already ended
    .sort(sortByDateTime);

  const savedIds = new Set(savedInRange.map((e) => String(e.id)));

  const allEvents = (await getCachedEvents(false))
    .filter((event) => event.startdate >= rangeStart && event.startdate <= rangeEnd)
    .filter((event) => !savedIds.has(String(event.id)))
    .filter(hasEnded) // Only show events that have already ended
    .sort(sortByDateTime);

  // 2. Check which saved events already have reviews
  const { data: reviewRows } = await supabase
    .from('Reviews')
    .select('event_id')
    .eq('user_id', user.id)
    .eq('entity_type', 'event');

  const reviewedEventIds = new Set(
    (reviewRows ?? []).map((r) => String(r.event_id))
  );

  // 3. Merge: saved first, then others
  const combined = [...savedInRange, ...allEvents];

  const events: AnnouncementEvent[] = combined.map((event) => ({
    id: String(event.id),
    title: event.title,
    subtitle: event.location || 'Unknown Venue',
    dayHeading: toDayHeading(event.startdate),
    href: `/events/${event.id}?showReviewModal=true`,
    startdate: event.startdate,
    isSaved: savedIds.has(String(event.id)),
    imageUrl: event.imageurl || undefined,
    needsReview: savedIds.has(String(event.id)) && !reviewedEventIds.has(String(event.id)),
  }));

  if (events.length === 0) return null;

  const savedCount = savedInRange.length;
  const unreviewedCount = events.filter((e) => e.needsReview).length;

  const header =
    unreviewedCount > 0
      ? `You saved ${savedCount} part${savedCount === 1 ? 'y' : 'ies'} — ${unreviewedCount} waiting for your review`
      : savedCount > 0
      ? `You saved ${savedCount} part${savedCount === 1 ? 'y' : 'ies'} recently`
      : 'How were the parties? Leave a review';

  return (
    <section className="mx-auto mb-8 mt-10 w-full max-w-[1400px] px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-400/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-6 shadow-[0_18px_50px_rgba(8,145,178,0.18)] dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
        />
        <LandingAnnouncementClient
          header={header}
          events={events}
          initialLimit={INITIAL_LIMIT}
          expandedLimit={EXPANDED_LIMIT}
          totalCount={combined.length}
          savedCount={savedCount}
          unreviewedCount={unreviewedCount}
        />
      </div>
    </section>
  );
}