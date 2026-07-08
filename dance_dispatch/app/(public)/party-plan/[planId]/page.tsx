import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCachedEvents } from '@/lib/utils_supabase_server';
import { Event } from '@/lib/utils';
import { getPlanFromId } from '@/lib/server_utils';
import { SavedPlan } from '../../profile/MakePartyPlanButton';
import CopyShareButton from './CopyShareButton';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function formatEventDate(startdate?: string | null, starttime?: string | null): string {
  const date = String(startdate ?? '').trim();
  if (!date) return 'Date TBD';

  const candidate = new Date(`${date}T${String(starttime ?? '').trim() || '00:00:00'}`);
  if (Number.isNaN(candidate.getTime())) {
    return date;
  }

  return candidate.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEventImageSrc(event: Event): string {
  return event.imageurl && event.imageurl.trim() ? event.imageurl : '/images/default_event.jpg';
}

export default async function PartyPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;

  if (!planId) {
    return (
      <main className="min-h-screen bg-bg text-text">
        <section className="container mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold">Party Plan</h1>
          <p className="mt-3 text-muted">This shared plan URL is missing event selections.</p>
          <Link href="/profile" className="mt-6 inline-block rounded-lg border border-default px-4 py-2 font-semibold hover:bg-accent-soft">
            Back to Profile
          </Link>
        </section>
      </main>
    );
  }

  const events = await getCachedEvents(false);
  const eventById = new Map(events.map((event: Event) => [Number(event.id), event]));


  const partyPlan: SavedPlan | null = await getPlanFromId(planId);
  
  if (!partyPlan) {
    notFound();
  }
  const selectedEvents = partyPlan.eventIds
    .map((id) => eventById.get(id))
    .filter((event): event is Event => Boolean(event));

  if (selectedEvents.length === 0) {
    notFound();
  }

  const summary = partyPlan.summary;

  const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/party-plan/${planId}`;

  return (
    <main className="min-h-screen bg-bg text-text">
      <section className="container mx-auto px-6 py-12">
        <div className="rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-6 shadow-[0_12px_35px_rgba(8,145,178,0.14)] dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">{partyPlan.username}'s Party Plan</p>
          <h1 className="mt-1 text-3xl font-bold">{partyPlan.name} Plan Summary</h1>
         <CopyShareButton shareUrl={shareUrl} />
          <p className="mt-2 text-sm text-muted">A shareable itinerary of RSVPed events.</p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-default bg-bg/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Parties</p>
              <p className="mt-1 text-2xl font-bold text-text">{summary.partyCount}</p>
            </div>
            <div className="rounded-lg border border-default bg-bg/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Date Range</p>
              <p className="mt-1 text-sm font-semibold text-text">{summary.dateRangeLabel}</p>
            </div>
            <div className="rounded-lg border border-default bg-bg/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Total Price</p>
              <p className="mt-1 text-sm font-semibold text-text">{currencyFormatter.format(summary.totalPrice)}</p>
            </div>
            <div className="rounded-lg border border-default bg-bg/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Location Flow</p>
              <p className="mt-1 text-sm font-semibold text-text">{summary.locationFlow}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-default bg-surface p-6">
          <h2 className="text-xl font-bold">Planned Stops</h2>
          <div className="mt-4 space-y-3">
            {selectedEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-stretch gap-4 rounded-lg border border-default px-4 py-3 transition hover:bg-accent-soft"
              >
                <div className="aspect-square w-20 sm:w-24 rounded-md flex-none">
                  <img
                    src={getEventImageSrc(event)}
                    alt={`${event.title} flyer`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-text">{event.title}</p>
                  <p className="mt-1 text-sm text-muted">{formatEventDate(event.startdate, event.starttime)}</p>
                  <p className="text-sm text-muted">{event.location || 'Location TBD'}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
