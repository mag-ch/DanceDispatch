import type { Metadata } from "next";
import { getCachedEvents, getCachedVenues } from "@/lib/utils_supabase_server";
import { getCurrentUserId } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { getCachedVenueCoordinatesOnly } from "@/lib/venue-geo";
import type { Venue } from "@/lib/utils";
import PartyMapClient, { type PendingVenueGroup } from "./PartyMapClient";

export const metadata: Metadata = {
  title: "Party Map | DanceDispatch",
  description: "See upcoming dance parties near you on an interactive map.",
};

export default async function PartyMapPage() {
  const [events, venues, userId] = await Promise.all([
    getCachedEvents(true),
    getCachedVenues(),
    getCurrentUserId(),
  ]);

  let savedEventIds: string[] = [];
  if (userId) {
    const supabase = await createClient();
    const { data } = await supabase.from("SavedEvents").select("event_id").eq("user_id", userId);
    savedEventIds = (data ?? []).map((row) => String(row.event_id));
  }

  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  const venuesNeeded = Array.from(
    new Map(
      events
        .map((event) => venueById.get(event.locationid))
        .filter((venue): venue is Venue => Boolean(venue))
        .map((venue) => [venue.id, venue])
    ).values()
  );

  // Only read already-cached coordinates here so the page never waits on the geocoder;
  // anything not yet cached is geocoded afterwards, in the background, from the client.
  const cachedCoordinatesByVenueId = await getCachedVenueCoordinatesOnly(
    venuesNeeded.map((venue) => venue.id)
  );

  const mapEvents = [];
  const pendingEventsByVenueId = new Map<string, PendingVenueGroup>();

  for (const event of events) {
    const venue = venueById.get(event.locationid);
    if (!venue) continue;

    const baseEvent = {
      id: event.id,
      title: event.title,
      startdate: event.startdate,
      starttime: event.starttime,
      enddate: event.enddate,
      endtime: event.endtime,
      location: event.location,
      imageurl: event.imageurl,
      price: event.price,
    };

    const cached = cachedCoordinatesByVenueId.get(venue.id);
    if (cached) {
      mapEvents.push({ ...baseEvent, lat: cached.lat, lng: cached.lng });
      continue;
    }

    if (!venue.address) continue;

    const group = pendingEventsByVenueId.get(venue.id) ?? {
      venueId: venue.id,
      address: venue.address,
      events: [],
    };
    group.events.push(baseEvent);
    pendingEventsByVenueId.set(venue.id, group);
  }

  // Prioritize geocoding venues whose soonest event is closest to today (either direction).
  const now = Date.now();
  const nearestEventDistanceMs = (group: PendingVenueGroup) =>
    Math.min(
      ...group.events.map((event) =>
        Math.abs(new Date(`${event.startdate}T${event.starttime || "00:00"}`).getTime() - now)
      )
    );

  const pendingVenues = Array.from(pendingEventsByVenueId.values()).sort(
    (a, b) => nearestEventDistanceMs(a) - nearestEventDistanceMs(b)
  );

    return (
    <main className="h-[calc(100dvh-4rem)] overflow-hidden bg-bg text-text lg:h-auto lg:min-h-screen lg:overflow-visible">
      <section className="container mx-auto flex h-full flex-col px-0 py-2 md:px-6 lg:h-auto lg:py-16">
        <div className="mb-8 hidden px-4 lg:block lg:px-0">
          <h1 className="text-3xl font-bold md:text-4xl">Party Map</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Explore upcoming parties on the map. Filter by date range or day/week/month, and toggle to only
            see events you&apos;ve RSVP&apos;ed to.
          </p>
        </div>

        <div className="min-h-0 flex-1 px-2 lg:px-0">
          <PartyMapClient events={mapEvents} pendingVenues={pendingVenues} savedEventIds={savedEventIds} />
        </div>
      </section>
    </main>
  );
}

