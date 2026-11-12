// File: src/app/page.tsx

import Link from "next/link";
import { Suspense } from "react";
import { getCachedEvents, getPendingReviewEventIds } from "@/lib/utils_supabase_server";
import { EventCard } from '@/app/components/EventCard';
import { createClient } from "@/lib/supabase/server";
import SearchBar from "./components/SearchBar";
import { SubmitEventButton } from "./components/SubmitEvent/SubmitEventButton";
import { LandingAnnouncementSection } from "./components/LandingAnnouncementModal";
import { EventRankingModalTrigger } from "./components/EventRankings/EventRankingModalTrigger";
import TrendingEventsClient from "./components/TrendingEventsClient";
import { getRecentActivitySections, type RecentActivityItem } from "@/lib/recent-activity";


export default async function LandingPage({ searchParams }: { searchParams: Promise<{ userId?: string; mission?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = params?.userId || user?.id;
  const sections = await getRecentActivitySections(userId);
  const activitySections = [
    { key: 'friends', title: 'Friends are going', items: sections.friendsGoing },
    { key: 'follows', title: 'From your follows', items: sections.fromFollows },
    { key: 'reviews', title: 'Reviews and Comments', items: sections.reviewsAndComments },
  ];
  // if (!user) {
  //   return <AuthPrompt />;
  // }

  return (    
    <main className="min-h-screen bg-bg text-text">
      <section
        className="relative min-h-[570px] overflow-hidden py-28 text-left shadow-sm sm:min-h-[590px] sm:py-32"
        style={{
          backgroundImage: "url(/images/24a06b12-a682-4cde-a1fa-a3f1c32af200_1024x608.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.7) 42%, rgba(0, 0, 0, 0.3) 100%), linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.93) 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 dark:hidden"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.8) 42%, rgba(255, 255, 255, 0.45) 100%), linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.95) 100%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="max-w-5xl">
            {/* <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime-400/60 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-lime-300 shadow-[0_0_18px_rgba(163,230,53,0.12)]">
              <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_8px_rgba(190,242,100,0.9)]" />
              24 parties tonight in Brooklyn
            </div> */}
            <h1 className="max-w-4xl font-[Impact,_Haettenschweiler,sans-serif] text-[clamp(2.25rem,8vw,5rem)] font-normal uppercase leading-[0.86]             tracking-[0.015em] text-slate-900 dark:text-white">
              Dispatching Dancers to the Club
                          <span className="inline-block bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 dark:from-fuchsia-400 dark:via-purple-300 dark:to-cyan-300 bg-clip-text text-transparent bg-[length:100%_auto]">
                One party at a time
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-7 text-slate-700 dark:text-white/75 sm:text-xl sm:leading-8">
              Find events by things you actually care about - sound, room, price, crowd. Then log your experience and share with friends!
            </p>
            <div className="mt-9 max-w-5xl">
              <SearchBar />
            </div>
          </div>
        </div>
      </section>
{/* 
      <section className="container mx-auto px-6 py-6">

      </section> */}
      <section className="mx-auto mb-4 mt-4 w-full max-w-[1400px] px-4 sm:px-6">
        <div className="relative">
          <div className="relative flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-text sm:text-xl">Recent Activity</h2>
            <Link
              href="/activity-feed"
              className="rounded-full border border-cyan-500/60 bg-white/70 px-3 py-1 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-400/40 dark:bg-transparent dark:text-cyan-300 dark:hover:bg-cyan-400/10"
            >
              View all activity
            </Link>
          </div>

          {activitySections.every((section) => section.items.length === 0) ? (
            <p className="relative mt-2 text-sm text-muted">No recent activity yet.</p>
          ) : (
            activitySections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <div key={section.key} className="relative mt-3">
                  <h3 className="text-sm font-bold text-text">{section.title}</h3>
                  <div className="mt-1.5 overflow-x-auto pb-1 overflow-y-hidden">
                    <div className="flex min-w-max snap-x snap-mandatory gap-3 pr-2 sm:gap-4">
                      {section.items.map((activity) => (
                        <ActivityCard key={activity.id} activity={activity} />
                      ))}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>


      <TrendingEvents selectedFilter={params.mission} />

      <LandingAnnouncementSection />

      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-center px-4 py-2 sm:px-6">
        <EventRankingModalTrigger />
        </div>
      
      
      <section className="mx-auto mb-10 w-full max-w-[1400px] px-4 sm:px-6">
        <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-100 via-yellow-50 to-white p-6 shadow-sm dark:border-yellow-400/30 dark:from-yellow-400/10 dark:via-surface dark:to-surface">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Leaderboard</p>
              <h2 className="mt-1 text-xl font-semibold text-text">Climb the board by RSVPing, sharing, reviewing, and referring.</h2>
            </div>
            <Link
              href="/leaderboard"
              className="btn-highlighted rounded-lg px-5 py-2.5 text-sm font-semibold w-fit"
            >
              View Leaderboard
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LeaderboardPreview />
          </div>
        </div>
      </section>

      <section className="bg-surface py-20 shadow-inner">
        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8 text-center">
          <ValueProp
            title="Save & RSVP"
            text="Keep track of events you want to attend."
          />
          <ValueProp
            title="Follow Venues & Promoters"
            text="Get updates from your favorite organizers."
          />
          <ValueProp
            title="Track Attended Events"
            text="Add notes and memories from events you've been to."
          />
        </div>
      </section>
      
{/* 
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-2xl font-semibold mb-8 text-center">Explore More</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <NavCard title="Browse All Events" href="/feed" />
          <NavCard title="Search" href="/search" />
          <NavCard title="My RSVPs" href="/my-events" />
          <NavCard title="Following" href="/following" />
        </div>
      </section> */}

      
    </main>
  );
}

const CITY_OPTIONS = ['New York City', 'New Jersey'];

async function CityPicker() {
    let city = (CITY_OPTIONS[0]);

    const savedCity = window.localStorage.getItem('dance-dispatch-city');
        if (savedCity && CITY_OPTIONS.includes(savedCity)) {
            city = savedCity;
        }

        

    const handleCityChange = (nextCity: string) => {
        city = nextCity;
        window.localStorage.setItem('dance-dispatch-city', nextCity);
    };

    return (
        <div className="border-b border-border bg-surface/80">
            <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2">
                <label htmlFor="city-picker" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Choose your city
                </label>
                <select
                    id="city-picker"
                    value={city}
                    onChange={(event) => handleCityChange(event.target.value)}
                    className="rounded-md border border-default bg-bg px-3 py-1.5 text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-accent"
                >
                    {CITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function timeAgo(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function shortDate(value?: string, withTime = false): string {
  const timestamp = value ? Date.parse(value) : NaN;
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function EntityEventsCard({ activity }: { activity: RecentActivityItem }) {
  const events = activity.entityEvents ?? [];

  return (
    <div className="flex h-[250px] w-[260px] shrink-0 snap-start flex-col rounded-xl border border-default bg-white p-3 shadow-sm transition hover:shadow-md dark:bg-bg/75 sm:w-[300px]">
      <Link href={activity.href} className="flex items-center gap-2">
        {activity.actorAvatar ? (
          <img src={activity.actorAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted/30" />
        )}
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-text">{activity.title}</p>
          <p className="text-xs text-muted">{activity.entityKind === 'venue' ? 'Venue' : 'Host'} you follow</p>
        </div>
      </Link>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        {events.map((event) => (
          <Link key={event.id} href={event.href} className="flex items-center gap-2">
            <img
              src={event.imageUrl || '/images/default_events.jpg'}
              alt=""
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-text">{event.title}</p>
              <p className="truncate text-xs text-muted">{shortDate(event.date, true)}</p>
            </div>
          </Link>
        ))}
      </div>

      {(activity.moreCount ?? 0) > 0 && (
        <div className="mt-2 border-t border-default pt-2 text-xs">
          <Link href={activity.href} className="font-semibold text-accent hover:underline">
            View More ({activity.moreCount})
          </Link>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity }: { activity: RecentActivityItem }) {
  if (activity.entityEvents) return <EntityEventsCard activity={activity} />;

  const isFollowEvent = activity.type === 'new_event';
  const handle = activity.actorName ?? 'Someone';
  const subline = isFollowEvent ? 'Upcoming' : timeAgo(activity.createdAt);
  const readLabel = isFollowEvent || activity.type === 'rsvp' ? 'View' : 'Read';

  return (
    <div className="flex h-[250px] w-[260px] shrink-0 snap-start flex-col rounded-xl border border-default bg-white p-3 shadow-sm transition hover:shadow-md dark:bg-bg/75 sm:w-[300px]">
      <Link href={activity.href} className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          {activity.actorAvatar ? (
            <img src={activity.actorAvatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-full bg-muted/30" />
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-text">{handle}</p>
            <p className="text-xs text-muted">
              {activity.type === 'rsvp' ? 'is going' : subline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <img
            src={activity.imageUrl || '/images/default_events.jpg'}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-text">{activity.eventTitle ?? activity.title}</p>
            <p className="truncate text-xs text-muted">
              {[shortDate(activity.eventDate), activity.venueName].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        {activity.excerpt && <p className="line-clamp-3 text-xs text-text">{activity.excerpt}</p>}

        {!activity.excerpt && activity.chips && activity.chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {activity.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-default px-2 py-0.5 text-[11px] text-muted">{chip}</span>
            ))}
          </div>
        )}
      </Link>

      <div className="mt-2 flex items-center justify-between border-t border-default pt-2 text-xs">
        {activity.nextHref && activity.nextDate ? (
          <Link href={activity.nextHref} className="min-w-0 truncate font-semibold text-accent hover:underline">
            Next{activity.nextLabel ? ` from ${activity.nextLabel}` : ''}: {shortDate(activity.nextDate)}
          </Link>
        ) : (
          <span />
        )}
        <Link href={activity.href} className="shrink-0 pl-2 font-semibold text-text hover:underline">{readLabel}</Link>
      </div>
    </div>
  );
}


async function TrendingEvents({ selectedFilter }: { selectedFilter?: string }) {
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-0 sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading events...</p>}>
        <TrendingEventCards initialFilter={selectedFilter ?? 'All'} />
      </Suspense>
    </section>
  );
}

async function TrendingEventCards({ initialFilter }: { initialFilter: string }) {
  const events = await getCachedEvents();

  return (
    <TrendingEventsClient
      events={events}
      initialFilter={initialFilter}
      cards={events.map((event) => <EventCard key={event.id} event={event} />)}
    />
  );
}

function ValueProp({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted">{text}</p>
    </div>
  );
}

const EXCLUDED_USER_ID = 'ba398812-06a0-4c48-9f15-0660d3af0047';

async function LeaderboardPreview() {
  const supabase = await createClient();

  const { data: pointRows, error: pointsError } = await supabase
    .from('UserPoints')
    .select('user_id, points')
    .neq('user_id', EXCLUDED_USER_ID)
    .order('created_at', { ascending: false });

  if (pointsError) {
    return <p className="text-sm text-muted sm:col-span-3">Leaderboard preview unavailable right now.</p>;
  }

  const totals = new Map<string, number>();
  for (const row of pointRows ?? []) {
    const points = Number(row.points ?? 0);
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + (Number.isFinite(points) ? points : 0));
  }

  const topIds = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([userId]) => userId);

  if (topIds.length === 0) {
    return <p className="text-sm text-muted sm:col-span-3">No leaderboard activity yet. Be the first to earn points.</p>;
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', topIds);

  const usernameById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile.username]));

  return (
    <>
      {topIds.map((userId, index) => {
        const name = usernameById.get(userId) ?? 'Unknown';
        const points = totals.get(userId) ?? 0;

        return (
          <div key={userId} className="rounded-xl border border-yellow-500/30 bg-white px-4 py-3 text-left shadow-sm dark:border-default dark:bg-bg/80">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Top {index + 1}</p>
            <p className="mt-1 text-base font-semibold text-text">{name}</p>
            <p className="text-sm text-muted">{points.toLocaleString()} points</p>
          </div>
        );
      })}
    </>
  );
}
