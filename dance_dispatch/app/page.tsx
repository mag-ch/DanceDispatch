// File: src/app/page.tsx

import Link from "next/link";
import { Suspense } from "react";
import { getCachedEvents, getCachedHosts, getCachedVenues } from "@/lib/utils_supabase_server";
import { EventCard } from '@/app/components/EventCard';
import { createClient } from "@/lib/supabase/server";
import SearchBar from "./components/SearchBar";
import { SubmitEventButton } from "./components/SubmitEvent/SubmitEventButton";
import { LandingAnnouncementSection } from "./components/LandingAnnouncementModal";
import { EventRankingModalTrigger } from "./components/EventRankings/EventRankingModalTrigger";

type RecentActivityItem = {
  id: string;
  type: 'review' | 'rsvp' | 'new_event' | 'follow_user' | 'follow_venue' | 'follow_host';
  createdAt: string;
  title: string;
  subtitle?: string;
  href: string;
};


export default async function LandingPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = params?.userId || user?.id;
  const recentActivity = await getRecentActivityFeed(userId);
  // if (!user) {
  //   return <AuthPrompt />;
  // }

  return (    
    <main className="min-h-screen bg-bg text-text">
      <section
        className="relative py-24 text-center shadow-sm"
        style={{
          backgroundImage: "url(/images/24a06b12-a682-4cde-a1fa-a3f1c32af200_1024x608.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-4 text-white">
            Are you ready to dance?
          </h1>
          <p className="text-lg text-white/70 mb-8">
            Dispatching dancers to the club, one party at a time.
          </p>
          <div className="max-w-2xl mx-auto">
            <SearchBar />
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/party-calendar"
                className="btn-highlighted rounded-md px-5 py-2.5 text-sm font-semibold"
              >
                Party Calendar
              </Link>
        
              <SubmitEventButton />
            </div>
            <div className="mt-6 text-sm text-white/70">
                  <Link
                href="/mission"
                className="rounded-md border border-default bg-surface/90 px-5 py-2.5 text-sm font-semibold text-text hover-bg-accent-soft"
              >
                What is our mission?
              </Link>
            </div>
          </div>
        </div>
      </section>
{/* 
      <section className="container mx-auto px-6 py-6">

      </section> */}

      <section className="container mx-auto mb-8 px-6 mt-10">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-6 shadow-[0_18px_50px_rgba(8,145,178,0.18)] dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
          />
        <LandingAnnouncementSection />   

          
        </div>
      </section>

      <div className="container mx-auto px-2 py-2 justify-center items-center flex">
        <EventRankingModalTrigger />
        </div>
      
      <section className="container mx-auto mb-8 px-6 mt-10">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-400/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-6 shadow-[0_18px_50px_rgba(8,145,178,0.18)] dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
          />


          <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-cyan-700 dark:text-cyan-300">Social Feed</p>
              <h2 className="mt-1 text-2xl font-extrabold text-text sm:text-3xl">Recent Activity</h2>
            </div>
            <p className="max-w-md text-sm text-muted">Latest reviews across all users plus your network activity.</p>
          </div>

          {recentActivity.length === 0 ? (
            <p className="relative mt-4 text-sm text-muted">No recent activity yet.</p>
          ) : (
            <div className="relative mt-6 overflow-x-auto pb-2 overflow-y-hidden">
              <div className="flex min-w-max snap-x snap-mandatory gap-3 pr-2 sm:gap-4">
                {recentActivity.map((activity) => {
                  const theme = recentActivityTheme(activity.type);

                  return (
                    <Link
                      key={activity.id}
                      href={activity.href}
                      className={`group w-[200px] h-[130px] shrink-0 snap-start rounded-xl border bg-bg/75 p-3 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-1 dark:bg-bg/75 sm:w-[300px] sm:h-[150px] sm:rounded-2xl sm:p-4 ${theme.cardClass}`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.2em] ${theme.badgeClass}`}>
                        {recentActivityLabel(activity.type)}
                      </p>
                      <p className="mt-1.5 text-sm font-semibold leading-snug text-text sm:mt-2 sm:text-base">{activity.title}</p>
                      {activity.subtitle && (
                        <p className="mt-1 text-xs text-muted line-clamp-2 sm:text-sm">{activity.subtitle}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between sm:mt-4">
                        <p className="text-[11px] font-medium text-muted sm:text-xs">{formatActivityDate(activity.createdAt)}</p>
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] opacity-0 transition group-hover:opacity-100 sm:text-xs sm:tracking-[0.16em] ${theme.badgeClass}`}>
                          View
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      
      <section className="container mx-auto px-6 py-6">
        <h2 className="text-2xl font-semibold mb-6">Chose your next mission!</h2>
        <Suspense fallback={<p>Loading events...</p>}>
          <TrendingEvents userId={userId} />
        </Suspense>
      </section>

      <section className="container mx-auto mb-10 px-6 ">
        <div className="rounded-2xl border border-yellow-400/30 bg-gradient-to-r from-yellow-50 via-surface to-surface p-6 shadow-sm dark:from-yellow-400/10">
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

async function getRecentActivityFeed(viewerUserId?: string): Promise<RecentActivityItem[]> {
  const supabase = await createClient();

  const { data: reviewRows, error: reviewsError } = await supabase
    .from('Reviews')
    .select('id, user_id, event_id, rating, comment, privacy_level, created_at, entity_type')
    .eq('entity_type', 'event')
    .neq('privacy_level', 'private')
    .order('created_at', { ascending: false })
    .limit(24);

  if (reviewsError) {
    console.error('Failed to fetch recent reviews:', reviewsError);
  }

  let followedUserIds: string[] = [];
  if (viewerUserId) {
    const { data: followedRows, error: followedError } = await supabase
      .from('UserFollowUsers')
      .select('followed_id')
      .eq('user_id', viewerUserId);

    if (followedError) {
      console.error('Failed to fetch followed users for recent activity:', followedError);
    } else {
      followedUserIds = [...new Set((followedRows ?? []).map((row: any) => String(row.followed_id)).filter(Boolean))];
    }
  }

  let savedEventRows: any[] = [];
  let followedUserRows: any[] = [];
  let followedVenueRows: any[] = [];
  let followedHostRows: any[] = [];
  let directlyFollowedVenueIds: string[] = [];
  let directlyFollowedHostIds: string[] = [];
  let recentEventRows: any[] = [];
  let recentEventHostRows: any[] = [];

  if (viewerUserId) {
    const [viewerVenueResult, viewerHostResult] = await Promise.all([
      supabase
        .from('UserFollowedVenues')
        .select('venue_id')
        .eq('user_id', viewerUserId),
      supabase
        .from('UserFollowedHosts')
        .select('host_id')
        .eq('user_id', viewerUserId),
    ]);

    if (viewerVenueResult.error) {
      console.error('Failed to fetch followed venues for recent activity:', viewerVenueResult.error);
    } else {
      directlyFollowedVenueIds = [
        ...new Set((viewerVenueResult.data ?? []).map((row: any) => String(row.venue_id)).filter(Boolean)),
      ];
    }

    if (viewerHostResult.error) {
      console.error('Failed to fetch followed hosts for recent activity:', viewerHostResult.error);
    } else {
      directlyFollowedHostIds = [
        ...new Set((viewerHostResult.data ?? []).map((row: any) => String(row.host_id)).filter(Boolean)),
      ];
    }
  }

  if (directlyFollowedVenueIds.length > 0 || directlyFollowedHostIds.length > 0) {
    const [recentEventsResult, eventHostsResult] = await Promise.all([
      supabase
        .from('Events')
        .select('id, title, location, created_at')
        .order('created_at', { ascending: false })
        .limit(120),
      directlyFollowedHostIds.length > 0
        ? supabase
            .from('event_hosts')
            .select('event_id, host_id')
            .in('host_id', directlyFollowedHostIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (recentEventsResult.error) {
      console.error('Failed to fetch newly posted events for recent activity:', recentEventsResult.error);
    } else {
      recentEventRows = recentEventsResult.data ?? [];
    }

    if (eventHostsResult.error) {
      console.error('Failed to fetch host-event links for recent activity:', eventHostsResult.error);
    } else {
      recentEventHostRows = eventHostsResult.data ?? [];
    }
  }

  if (followedUserIds.length > 0) {
    const [savedResult, followedUserResult, followedVenueResult, followedHostResult] = await Promise.all([
      supabase
        .from('SavedEvents')
        .select('id, user_id, event_id, created_at')
        .in('user_id', followedUserIds)
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('UserFollowUsers')
        .select('id, user_id, followed_id, created_at')
        .in('user_id', followedUserIds)
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('UserFollowedVenues')
        .select('id, user_id, venue_id, created_at')
        .in('user_id', followedUserIds)
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('UserFollowedHosts')
        .select('id, user_id, host_id, created_at')
        .in('user_id', followedUserIds)
        .order('created_at', { ascending: false })
        .limit(24),
    ]);

    if (savedResult.error) {
      console.error('Failed to fetch recent RSVPs:', savedResult.error);
    } else {
      savedEventRows = savedResult.data ?? [];
    }

    if (followedUserResult.error) {
      console.error('Failed to fetch recent user follows:', followedUserResult.error);
    } else {
      followedUserRows = followedUserResult.data ?? [];
    }

    if (followedVenueResult.error) {
      console.error('Failed to fetch recent venue follows:', followedVenueResult.error);
    } else {
      followedVenueRows = followedVenueResult.data ?? [];
    }

    if (followedHostResult.error) {
      console.error('Failed to fetch recent host follows:', followedHostResult.error);
    } else {
      followedHostRows = followedHostResult.data ?? [];
    }
  }

  const userIds = new Set<string>();
  const eventIds = new Set<string>();

  for (const row of reviewRows ?? []) {
    userIds.add(String(row.user_id));
    eventIds.add(String(row.event_id));
  }

  for (const row of savedEventRows) {
    userIds.add(String(row.user_id));
    eventIds.add(String(row.event_id));
  }

  for (const row of followedUserRows) {
    userIds.add(String(row.user_id));
    userIds.add(String(row.followed_id));
  }

  for (const row of followedVenueRows) {
    userIds.add(String(row.user_id));
  }

  for (const row of followedHostRows) {
    userIds.add(String(row.user_id));
  }

  let usernameById = new Map<string, string>();
  const idsForLookup = Array.from(userIds).filter(Boolean);
  if (idsForLookup.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .in('id', idsForLookup);

    if (profilesError) {
      console.error('Failed to fetch profile names for activity feed:', profilesError);
    } else {
      usernameById = new Map(
        (profiles ?? []).map((profile: any) => [
          String(profile.id),
          String(profile.username || profile.full_name || 'Someone'),
        ])
      );
    }
  }

  const [events, venues, hosts] = await Promise.all([
    getCachedEvents(false),
    getCachedVenues(),
    getCachedHosts(),
  ]);

  const eventById = new Map(events.map((event: any) => [String(event.id), event]));
  const venueById = new Map(venues.map((venue: any) => [String(venue.id), venue]));
  const hostById = new Map(hosts.map((host: any) => [String(host.id), host]));
  const followedVenueIdSet = new Set(directlyFollowedVenueIds);
  const followedHostIdSet = new Set(directlyFollowedHostIds);
  const followedHostIdsByEventId = new Map<string, string[]>();

  for (const row of recentEventHostRows) {
    const eventId = String(row.event_id ?? '');
    const hostId = String(row.host_id ?? '');
    if (!eventId || !hostId || !followedHostIdSet.has(hostId)) {
      continue;
    }

    const existing = followedHostIdsByEventId.get(eventId) ?? [];
    existing.push(hostId);
    followedHostIdsByEventId.set(eventId, existing);
  }

  const activities: RecentActivityItem[] = [];

  for (const row of reviewRows ?? []) {
    const actorName = row.privacy_level === 'anonymous'
      ? 'Anonymous'
      : (usernameById.get(String(row.user_id)) ?? 'Someone');
    const event = eventById.get(String(row.event_id));
    const eventTitle = event?.title || 'an event';

    activities.push({
      id: `review-${row.id}`,
      type: 'review',
      createdAt: String(row.created_at ?? ''),
      title: `${actorName} left a review`,
      subtitle: eventTitle,
      href: event?.id ? `/events/${event.id}` : '/search',
    });
  }

  for (const row of savedEventRows) {
    const actorName = usernameById.get(String(row.user_id)) ?? 'Someone you follow';
    const event = eventById.get(String(row.event_id));
    const eventTitle = event?.title || 'an event';

    activities.push({
      id: `rsvp-${row.id}`,
      type: 'rsvp',
      createdAt: String(row.created_at ?? ''),
      title: `${actorName} RSVPed`,
      subtitle: eventTitle,
      href: event?.id ? `/events/${event.id}` : '/party-calendar',
    });
  }

  for (const row of followedUserRows) {
    const actorName = usernameById.get(String(row.user_id)) ?? 'Someone you follow';
    const followedName = usernameById.get(String(row.followed_id)) ?? 'a user';

    activities.push({
      id: `follow-user-${row.id}`,
      type: 'follow_user',
      createdAt: String(row.created_at ?? ''),
      title: `${actorName} followed ${followedName}`,
      href: `/users/${row.followed_id}`,
    });
  }

  for (const row of followedVenueRows) {
    const actorName = usernameById.get(String(row.user_id)) ?? 'Someone you follow';
    const venue = venueById.get(String(row.venue_id));
    const venueName = venue?.name || 'a venue';

    activities.push({
      id: `follow-venue-${row.id}`,
      type: 'follow_venue',
      createdAt: String(row.created_at ?? ''),
      title: `${actorName} followed ${venueName}`,
      href: venue?.id ? `/venues/${venue.id}` : '/search',
    });
  }

  for (const row of followedHostRows) {
    const actorName = usernameById.get(String(row.user_id)) ?? 'Someone you follow';
    const host = hostById.get(String(row.host_id));
    const hostName = host?.name || 'a host';

    activities.push({
      id: `follow-host-${row.id}`,
      type: 'follow_host',
      createdAt: String(row.created_at ?? ''),
      title: `${actorName} followed ${hostName}`,
      href: host?.id ? `/hosts/${host.id}` : '/search',
    });
  }

  for (const row of recentEventRows) {
    const eventId = String(row.id ?? '');
    if (!eventId) {
      continue;
    }

    const venueMatch = followedVenueIdSet.has(String(row.location ?? ''));
    const matchedHostIds = followedHostIdsByEventId.get(eventId) ?? [];
    if (!venueMatch && matchedHostIds.length === 0) {
      continue;
    }

    const event = eventById.get(eventId);
    const truncatedTitle = String(row.title ?? '').length > 40 ? String(row.title ?? '').slice(0, 37) + '...' : String(row.title ?? '');
    const eventTitle = truncatedTitle || String(row.title ?? 'a new event');

    let subtitle = 'From entities you follow';
    if (venueMatch) {
      const venue = venueById.get(String(row.location));
      subtitle = venue?.name ? `Posted by ${venue.name}` : subtitle;
    } else if (matchedHostIds.length > 0) {
      const host = hostById.get(matchedHostIds[0]);
      subtitle = host?.name ? `Posted by ${host.name}` : subtitle;
    }

    activities.push({
      id: `new-event-${eventId}`,
      type: 'new_event',
      createdAt: String(row.created_at ?? ''),
      title: `New event posted: ${eventTitle}`,
      subtitle,
      href: `/events/${eventId}`,
    });
  }

  return activities
    .filter((item) => !Number.isNaN(Date.parse(item.createdAt)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 24);
}

function recentActivityLabel(type: RecentActivityItem['type']): string {
  if (type === 'review') return 'Review';
  if (type === 'rsvp') return 'RSVP';
  if (type === 'new_event') return 'New Event';
  if (type === 'follow_user') return 'Followed User';
  if (type === 'follow_venue') return 'Followed Venue';
  return 'Followed Host';
}

function recentActivityTheme(type: RecentActivityItem['type']): { cardClass: string; badgeClass: string } {
  if (type === 'review') {
    return {
      cardClass: 'border-cyan-200/60 hover:border-cyan-400/70 hover:shadow-[0_12px_30px_rgba(8,145,178,0.2)]',
      badgeClass: 'text-cyan-700 dark:text-cyan-300',
    };
  }

  if (type === 'rsvp') {
    return {
      cardClass: 'border-purple-200/70 hover:border-purple-400/75 hover:shadow-[0_12px_30px_rgba(147,51,234,0.22)]',
      badgeClass: 'text-purple-700 dark:text-purple-300',
    };
  }

  if (type === 'new_event') {
    return {
      cardClass: 'border-blue-200/70 hover:border-blue-400/75 hover:shadow-[0_12px_30px_rgba(37,99,235,0.24)]',
      badgeClass: 'text-blue-700 dark:text-blue-300',
    };
  }

  return {
    cardClass: 'border-cyan-200/60 hover:border-cyan-400/70 hover:shadow-[0_12px_30px_rgba(8,145,178,0.2)]',
    badgeClass: 'text-cyan-700 dark:text-cyan-300',
  };
}

function formatActivityDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'Just now';
  }

  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}


async function TrendingEvents({ userId }: { userId?: string }) {
  const events = await getCachedEvents();

  if (!events.length) {
    return <p>No events available.</p>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {events.map((event: any) => (
        <EventCard key={event.id} event={event}/>
      ))}
    </div>
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


async function LeaderboardPreview() {
  const supabase = await createClient();

  const { data: pointRows, error: pointsError } = await supabase
    .from('UserPoints')
    .select('user_id, points')
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
          <div key={userId} className="rounded-xl border border-border bg-bg/80 px-4 py-3 text-left shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Top {index + 1}</p>
            <p className="mt-1 text-base font-semibold text-text">{name}</p>
            <p className="text-sm text-muted">{points.toLocaleString()} points</p>
          </div>
        );
      })}
    </>
  );
}
