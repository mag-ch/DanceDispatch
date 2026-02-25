// File: src/app/page.tsx

import Link from "next/link";
import { Suspense } from "react";
import { getEvents } from "@/lib/utils"; 
import { EventCard } from "./components/EventCard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";


export default async function LandingPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = params?.userId || user?.id;

  // if (!user) {
  //   return <AuthPrompt />;
  // }

  return (    
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <section className="py-24 text-center bg-white shadow-sm">
        <h1 className="text-4xl font-bold mb-4">
          Are you ready to dance?
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          For the house community, by the house community.
        </p>
        <div className="max-w-2xl mx-auto">
          <SearchBar />
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-6">Trending Events</h2>
        <Suspense fallback={<p>Loading events...</p>}>
          <TrendingEvents userId={userId} />
        </Suspense>
      </section>

      <section className="bg-white py-20 shadow-inner">
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

      <section className="container mx-auto px-6 py-20">
        <h2 className="text-2xl font-semibold mb-8 text-center">Explore More</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <NavCard title="Browse All Events" href="/feed" />
          <NavCard title="Search" href="/search" />
          <NavCard title="My RSVPs" href="/my-events" />
          <NavCard title="Following" href="/following" />
        </div>
      </section>
    </main>
  );
}


async function TrendingEvents({ userId }: { userId?: string }) {
  const events = await getEvents();

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

function SearchBar() {
  return (
    <form action="/search" method="get" className="flex gap-2">
      <input
        type="text"
        name="query"
        placeholder="Search events, organizers, or hosts..."
        className="flex-grow p-3 rounded-md border border-gray-300"
      />
      <button type="submit" className="px-4 py-3 bg-black text-white rounded-md hover:bg-gray-800">
        Search
      </button>
    </form>
  );
}

function ValueProp({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{text}</p>
    </div>
  );
}

function NavCard({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-center"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
    </Link>
  );
}
