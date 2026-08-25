'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MapBoundsBox } from './PartyMapView';

export type MapPartyEvent = {
  id: string;
  title: string;
  startdate: string;
  starttime: string;
  enddate: string;
  endtime: string;
  location: string;
  imageurl?: string;
  price?: number;
  lat: number;
  lng: number;
};

type PendingEventInfo = Omit<MapPartyEvent, 'lat' | 'lng'>;

export type PendingVenueGroup = {
  venueId: string;
  address: string;
  events: PendingEventInfo[];
};

type PartyMapClientProps = {
  events: MapPartyEvent[];
  pendingVenues: PendingVenueGroup[];
  savedEventIds: string[];
};

type QuickRange = 'day' | 'week' | 'month';

// Batch size for progressive background geocoding, matching the server's concurrency cap.
const GEOCODE_CHUNK_SIZE = 5;

const PartyMapView = dynamic(() => import('./PartyMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center rounded-lg border border-default bg-surface text-sm text-muted">
      Loading map...
    </div>
  ),
});

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const dayStart = startOfDay(date);
  const mondayFirstIndex = (dayStart.getDay() + 6) % 7;
  dayStart.setDate(dayStart.getDate() - mondayFirstIndex);
  return dayStart;
}

function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function rangeForQuickSelect(range: QuickRange): { start: string; end: string } {
  const now = new Date();

  if (range === 'day') {
    const day = startOfDay(now);
    return { start: formatYmd(day), end: formatYmd(day) };
  }

  if (range === 'week') {
    const start = startOfWeek(now);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: formatYmd(start), end: formatYmd(end) };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: formatYmd(start), end: formatYmd(end) };
}

function formatEventListWhen(event: MapPartyEvent): string {
  const start = new Date(`${event.startdate}T${event.starttime || '00:00'}`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(start);
}

function EventListItem({
  event,
  isSelected,
  onSelect,
}: {
  event: MapPartyEvent;
  isSelected: boolean;
  onSelect: (eventId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event.id)}
      className={`flex w-full gap-3 rounded-lg border p-2 text-left transition hover-bg-accent-soft ${
        isSelected ? 'border-accent bg-accent/10' : 'border-default'
      }`}
    >
      <img
        src={event.imageurl || '/images/default_event.jpg'}
        alt={event.title}
        className="h-14 w-14 flex-shrink-0 rounded object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{event.title}</p>
        <p className="text-xs text-muted">{formatEventListWhen(event)}</p>
        <p className="truncate text-xs text-muted">{event.location}</p>
        <Link
          href={`/events/${event.id}`}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          className="text-xs font-semibold text-accent underline"
        >
          View event
        </Link>
      </div>
    </button>
  );
}

function EventListPanel({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: MapPartyEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">No parties match the selected filters.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <EventListItem
          key={event.id}
          event={event}
          isSelected={event.id === selectedEventId}
          onSelect={onSelectEvent}
        />
      ))}
    </div>
  );
}

export default function PartyMapClient({ events, pendingVenues, savedEventIds }: PartyMapClientProps) {
  const [startFilter, setStartFilter] = useState<string>('');
  const [endFilter, setEndFilter] = useState<string>('');
  const [activeQuickRange, setActiveQuickRange] = useState<QuickRange | null>(null);
  const [showRsvpOnly, setShowRsvpOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBoundsBox | null>(null);
  const [geocodedEvents, setGeocodedEvents] = useState<MapPartyEvent[]>([]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      // Denied, unavailable, or timed out: the map still renders fine without a user location.
      () => setUserLocation(null),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 }
    );
  }, []);

  useEffect(() => {
    if (pendingVenues.length === 0) {
      return;
    }

    let cancelled = false;

    // Geocode venues in the background, in priority (nearest-date) order, in small chunks
    // so the map fills in progressively instead of waiting for every venue to resolve.
    async function loadPendingVenues() {
      for (let start = 0; start < pendingVenues.length; start += GEOCODE_CHUNK_SIZE) {
        if (cancelled) return;
        const chunk = pendingVenues.slice(start, start + GEOCODE_CHUNK_SIZE);

        try {
          const response = await fetch('/api/party-map/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              venues: chunk.map((venue) => ({ id: venue.venueId, address: venue.address })),
            }),
          });

          if (!response.ok || cancelled) continue;

          const payload = await response.json();
          const coordinates = (payload?.coordinates ?? {}) as Record<string, { lat: number; lng: number }>;

          const resolvedEvents: MapPartyEvent[] = [];
          for (const venue of chunk) {
            const coords = coordinates[venue.venueId];
            if (!coords) continue;
            for (const pendingEvent of venue.events) {
              resolvedEvents.push({ ...pendingEvent, lat: coords.lat, lng: coords.lng });
            }
          }

          if (!cancelled && resolvedEvents.length > 0) {
            setGeocodedEvents((current) => [...current, ...resolvedEvents]);
          }
        } catch (error) {
          console.error('Failed to geocode a chunk of party map venues:', error);
        }
      }
    }

    void loadPendingVenues();

    return () => {
      cancelled = true;
    };
  }, [pendingVenues]);

  const allEvents = useMemo(() => [...events, ...geocodedEvents], [events, geocodedEvents]);

  const savedEventIdSet = useMemo(() => new Set(savedEventIds.map((id) => String(id))), [savedEventIds]);

  const filteredEvents = useMemo(() => {
    const hasDateFilter = Boolean(startFilter || endFilter);
    const now = new Date();

    return allEvents.filter((event) => {
      if (showRsvpOnly && !savedEventIdSet.has(String(event.id))) {
        return false;
      }

      const eventStart = new Date(`${event.startdate}T${event.starttime || '00:00'}`);

      // No explicit date range chosen: default to upcoming parties only.
      if (!hasDateFilter) {
        const eventEnd = new Date(`${event.enddate}T${event.endtime || event.starttime || '23:59:59'}`);
        if (eventEnd < now) {
          return false;
        }
      }

      if (startFilter) {
        const rangeStart = new Date(`${startFilter}T00:00:00`);
        if (eventStart < rangeStart) {
          return false;
        }
      }

      if (endFilter) {
        const rangeEnd = new Date(`${endFilter}T23:59:59.999`);
        if (eventStart > rangeEnd) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, startFilter, endFilter, showRsvpOnly, savedEventIdSet]);

  useEffect(() => {
    // Drop the selection once its event scrolls out of the active filters.
    if (selectedEventId && !filteredEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [filteredEvents, selectedEventId]);

  // Narrows the list to whatever is currently visible on the map as the user pans/zooms.
  const visibleEvents = useMemo(() => {
    if (!mapBounds) {
      return filteredEvents;
    }

    return filteredEvents.filter(
      (event) =>
        event.lat <= mapBounds.north
        && event.lat >= mapBounds.south
        && event.lng <= mapBounds.east
        && event.lng >= mapBounds.west
    );
  }, [filteredEvents, mapBounds]);

  const applyQuickRange = (range: QuickRange) => {
    const { start, end } = rangeForQuickSelect(range);
    setStartFilter(start);
    setEndFilter(end);
    setActiveQuickRange(range);
  };

  const clearFilters = () => {
    setStartFilter('');
    setEndFilter('');
    setActiveQuickRange(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-xl border border-default bg-surface p-3 shadow-sm md:p-5">
        <div className="grid w-full grid-cols-3 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
          <button
            type="button"
            onClick={() => applyQuickRange('day')}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              activeQuickRange === 'day' ? 'border-accent bg-accent text-white' : 'border-default hover-bg-accent-soft'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange('week')}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              activeQuickRange === 'week' ? 'border-accent bg-accent text-white' : 'border-default hover-bg-accent-soft'
            }`}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange('month')}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              activeQuickRange === 'month' ? 'border-accent bg-accent text-white' : 'border-default hover-bg-accent-soft'
            }`}
          >
            This Month
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-end md:gap-3">
          <label className="flex flex-col text-sm">
            Start Date
            <input
              type="date"
              value={startFilter}
              onChange={(event) => {
                setStartFilter(event.target.value);
                setActiveQuickRange(null);
              }}
              className="mt-1 w-full rounded-md border border-default bg-surface px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            End Date
            <input
              type="date"
              value={endFilter}
              onChange={(event) => {
                setEndFilter(event.target.value);
                setActiveQuickRange(null);
              }}
              className="mt-1 w-full rounded-md border border-default bg-surface px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-default px-3 py-2 text-sm font-medium hover-bg-accent-soft sm:col-span-2 md:col-span-1"
          >
            Clear Filters
          </button>
          <label className="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm font-medium sm:col-span-2 md:col-span-1">
            <input
              type="checkbox"
              checked={showRsvpOnly}
              onChange={(event) => setShowRsvpOnly(event.target.checked)}
              className="h-4 w-4"
            />
            RSVP Only
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <PartyMapView
            events={filteredEvents}
            userLocation={userLocation}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onBoundsChange={setMapBounds}
          />
        </div>

        {/* Desktop: persistent sidebar list of events in scope */}
        <aside className="hidden w-80 shrink-0 rounded-xl border border-default bg-surface p-3 shadow-sm lg:block">
          <h2 className="mb-2 text-sm font-semibold text-text">
            Parties in view ({visibleEvents.length})
          </h2>
          <div className="max-h-[600px] overflow-y-auto pr-1">
            <EventListPanel
              events={visibleEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </div>
        </aside>
      </div>

      {/* Mobile: collapsible drawer for the same event list */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsListOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-default bg-surface px-4 py-3 text-sm font-semibold text-text shadow-sm"
          aria-expanded={isListOpen}
        >
          <span>Parties in view ({visibleEvents.length})</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isListOpen ? 'rotate-180' : ''}`} />
        </button>

        {isListOpen && (
          <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-default bg-surface p-3 shadow-sm">
            <EventListPanel
              events={visibleEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
