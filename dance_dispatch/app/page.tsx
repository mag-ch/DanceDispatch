// File: src/app/page.tsx

import Link from "next/link";
import { Suspense } from "react";
import { getCachedEvents } from "@/lib/utils_supabase_server";
import { EventCard } from '@/app/components/EventCard';
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SearchBar from "./components/SearchBar";
import { SubmitEventButton } from "./components/SubmitEventButton";


export default async function LandingPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = params?.userId || user?.id;
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
  
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-6">Trending Events</h2>
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

function NavCard({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="p-6 bg-surface rounded-lg shadow hover:shadow-md transition-shadow text-center"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
    </Link>
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
