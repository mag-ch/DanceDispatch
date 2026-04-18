import type { Metadata } from "next";
import PartyCalendarClient from "./PartyCalendarClient";
import { getCachedEvents } from "@/lib/utils_supabase_server";

export const metadata: Metadata = {
  title: "Party Calendar | DanceDispatch",
  description: "Browse upcoming dance parties by day, week, or month.",
};

export default async function PartyCalendarPage() {
  const events = await getCachedEvents(false);

  return (
    <main className="min-h-screen bg-bg text-text">
      <section className="container mx-auto px-6 py-12 md:py-16">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Party Calendar</h1>
          <p className="mt-2 text-muted max-w-2xl">
            Explore the same trending event feed in an interactive calendar. Switch between month, week, and day layouts, then narrow dates with custom filters.
          </p>
        </div>

        <PartyCalendarClient events={events} />
      </section>
    </main>
  );
}
