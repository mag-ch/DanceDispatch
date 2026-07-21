import { getCachedEvents } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import { getSavedEventsForUserServer } from '@/lib/server_utils';
import { EventRankingModal, ModalComparison, ModalEvent } from './EventRankingModal';

const LOOKBACK_DAYS = 7;
const MIN_EVENTS_TO_RANK = 2;

function getDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split('T')[0];
}

function getWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function toModalEvent(event: any): ModalEvent {
  return {
    id: String(event.id),
    title: event.title,
    subtitle: event.location || 'Unknown Venue',
    imageUrl: event.imageurl || undefined,
    date: event.startdate,
  };
}

export async function EventRankingModalTrigger() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const rangeStart = getDateString(LOOKBACK_DAYS);
  const rangeEnd = getDateString(0);
  const weekKey = getWeekKey();

  const savedEvents = await getSavedEventsForUserServer(user.id, 'past');
  const attended = savedEvents.filter(
    (e) => e.startdate >= rangeStart && e.startdate <= rangeEnd
  );

  if (attended.length <= MIN_EVENTS_TO_RANK) return null;

  const { data: comparisons } = await supabase
    .from('event_comparisons')
    .select('id, event_a_id, event_b_id, winner_is_a')
    .eq('user_id', user.id)
    .eq('week_key', weekKey);

  const { data: rankings } = await supabase
    .from('event_rankings')
    .select('event_id, rank, score')
    .eq('user_id', user.id)
    .eq('week_key', weekKey)
    .order('rank', { ascending: true });

  const eventMap = new Map(attended.map((e) => [String(e.id), e]));

  const comparisonList: ModalComparison[] = (comparisons ?? [])
    .map((c) => {
      const eventA = eventMap.get(String(c.event_a_id));
      const eventB = eventMap.get(String(c.event_b_id));
      if (!eventA || !eventB) return null;
      return {
        id: c.id,
        eventA: toModalEvent(eventA),
        eventB: toModalEvent(eventB),
        winnerId: c.winner_is_a ? String(c.event_a_id) : String(c.event_b_id),
      };
    })
    .filter(Boolean) as ModalComparison[];

  const completedPairs = new Set(
    (comparisons ?? []).map(
      (c) =>
        `${Math.min(Number(c.event_a_id), Number(c.event_b_id))}-${Math.max(
          Number(c.event_a_id),
          Number(c.event_b_id)
        )}`
    )
  );

  const remainingPairs: [ModalEvent, ModalEvent][] = [];
  for (let i = 0; i < attended.length; i++) {
    for (let j = i + 1; j < attended.length; j++) {
      const aId = Math.min(Number(attended[i].id), Number(attended[j].id));
      const bId = Math.max(Number(attended[i].id), Number(attended[j].id));
      if (!completedPairs.has(`${aId}-${bId}`)) {
        remainingPairs.push([toModalEvent(attended[i]), toModalEvent(attended[j])]);
      }
    }
  }

  const allEvents = await getCachedEvents(false);
  const savedIds = new Set(attended.map((e) => String(e.id)));
  const reviewableEvents = allEvents
    .filter((e) => e.startdate >= rangeStart && e.startdate <= rangeEnd)
    .filter((e) => !savedIds.has(String(e.id)))
    .map(toModalEvent);

  const initialMatchup =
    remainingPairs.length > 0
      ? remainingPairs[Math.floor(Math.random() * remainingPairs.length)]
      : null;

  return (
    <EventRankingModal
      initialMatchup={initialMatchup}
      remainingPairs={remainingPairs}
      comparisons={comparisonList}
      rankings={
        rankings?.map((r) => ({
          eventId: String(r.event_id),
          rank: r.rank,
          score: r.score ?? 0,
        })) ?? []
      }
      reviewableEvents={reviewableEvents}
      attendedEvents={attended.map(toModalEvent)}
    />
  );
}