'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    <div className="flex h-full min-h-0 w-full items-center justify-center rounded-lg border border-default bg-surface text-sm text-muted">
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
      data-event-id={event.id}
      onClick={() => onSelect(event.id)}
      className={`flex w-full gap-3 rounded-lg border p-2 text-left transition hover-bg-accent-soft ${
        isSelected ? 'border-accent bg-accent/10' : 'border-default'
      }`}
    >
      <img
        src={event.imageurl || '/images/default_events.jpg'}
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedEventId) return;
    const target = containerRef.current?.querySelector<HTMLElement>(
      `[data-event-id="${CSS.escape(selectedEventId)}"]`
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedEventId]);

  if (events.length === 0) {
    return <p className="text-sm text-muted">No parties match the selected filters.</p>;
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {events.map((event) => (
        <EventListItem
          key={event.id + '-listview'}
          event={event}
          isSelected={event.id === selectedEventId}
          onSelect={onSelectEvent}
        />
      ))}
    </div>
  );
}

export default function PartyMapClient({ events, pendingVenues, savedEventIds }: PartyMapClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [startFilter, setStartFilter] = useState<string>('');
  const [endFilter, setEndFilter] = useState<string>('');
  const [activeQuickRange, setActiveQuickRange] = useState<QuickRange | null>(null);
  const [showRsvpOnly, setShowRsvpOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBoundsBox | null>(null);
  const [geocodedEvents, setGeocodedEvents] = useState<MapPartyEvent[]>([]);
  const drawerTouchStart = useRef<number | null>(null);

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

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setIsDrawerExpanded(true);
  };

  const savedEventIdSet = useMemo(() => new Set(savedEventIds.map((id) => String(id))), [savedEventIds]);

  const filteredEvents = useMemo(() => {
    const hasDateFilter = Boolean(startFilter || endFilter);
    const now = new Date();
    const query = searchQuery.trim().toLowerCase();

    return allEvents.filter((event) => {
      if (showRsvpOnly && !savedEventIdSet.has(String(event.id))) {
        return false;
      }

      if (
        query &&
        !event.title.toLowerCase().includes(query) &&
        !event.location.toLowerCase().includes(query)
      ) {
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
  }, [allEvents, startFilter, endFilter, showRsvpOnly, savedEventIdSet, searchQuery]);

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
        event.lat <= mapBounds.north &&
        event.lat >= mapBounds.south &&
        event.lng <= mapBounds.east &&
        event.lng >= mapBounds.west
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

  const handleMapInteraction = () => {
    setIsDrawerExpanded(false);
    setIsFiltersOpen(false);
  };

  const handleDrawerHandleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    drawerTouchStart.current = event.touches[0]?.clientY ?? null;
  };

  const handleDrawerHandleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (drawerTouchStart.current === null) return;
    const touchEnd = event.changedTouches[0]?.clientY;
    if (touchEnd === undefined) return;
    const delta = touchEnd - drawerTouchStart.current;
    if (delta < -30) setIsDrawerExpanded(true);
    if (delta > 30) setIsDrawerExpanded(false);
    drawerTouchStart.current = null;
  };

  const filtersActive = Boolean(activeQuickRange || startFilter || endFilter || showRsvpOnly);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 lg:h-auto lg:gap-4">
      {/* Mobile: search bar + filter toggle */}
      <div className="flex shrink-0 items-center gap-2 lg:hidden">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search parties..."
            className="w-full rounded-md border border-default bg-surface py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsFiltersOpen((current) => !current)}
          aria-expanded={isFiltersOpen}
          className={`flex shrink-0 items-center justify-center rounded-md border p-2 transition ${
            isFiltersOpen || filtersActive
              ? 'border-accent bg-accent text-white'
              : 'border-default hover-bg-accent-soft'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Filters: collapsible overlay on mobile, static panel on desktop */}
      <div className="relative shrink-0 lg:static">
        <div
          className={`${isFiltersOpen ? 'block' : 'hidden'} absolute left-0 right-0 top-0 z-[1000] rounded-xl border border-default bg-surface/40 dark:bg-surface/40 p-3 shadow-lg backdrop-blur lg:static lg:z-auto lg:block lg:rounded-xl lg:border lg:bg-surface lg:p-5 lg:shadow-sm lg:backdrop-blur-none`}
        >
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

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-4 lg:flex lg:flex-wrap lg:items-end lg:gap-3">
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
              className="rounded-md border border-default px-3 py-2 text-sm font-medium hover-bg-accent-soft sm:col-span-2 lg:col-span-1"
            >
              Clear Filters
            </button>
            <label className="flex items-center gap-2 rounded-md border border-default px-3 py-2 text-sm font-medium sm:col-span-2 lg:col-span-1">
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
      </div>

      <div className="relative min-h-0 flex-1 lg:flex lg:gap-4">
        <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden lg:rounded-xl">
          <PartyMapView
            events={filteredEvents}
            userLocation={userLocation}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            onBoundsChange={setMapBounds}
            onInteraction={handleMapInteraction}
          />

          {/* Mobile: bottom drawer, overlays the map instead of pushing it */}
          <div className="absolute inset-x-0 bottom-0 z-[900] lg:hidden">
            <div
              className="flex justify-center rounded-t-2xl border border-b-0 border-default bg-surface/40 dark:bg-surface/40 py-2 shadow-2xl backdrop-blur"
              onTouchStart={handleDrawerHandleTouchStart}
              onTouchEnd={handleDrawerHandleTouchEnd}
              onClick={() => setIsDrawerExpanded((prev) => !prev)}
              role="button"
              aria-expanded={isDrawerExpanded}
              aria-label="Toggle parties list"
            >
              <span className="h-1.5 w-10 rounded-full bg-text/30" />
            </div>
            <div
              className={`overflow-hidden border-x border-default bg-surface/40 dark:bg-surface/40 shadow-2xl backdrop-blur transition-[max-height] duration-200 ${
                isDrawerExpanded ? 'max-h-[50%]' : 'max-h-0'
              }`}
            >
              <div className="max-h-[50vh] overflow-y-auto px-3 pb-3">
                <p className="pb-2 pt-1 text-xs font-semibold text-muted">
                  Parties in view ({visibleEvents.length})
                </p>
                <EventListPanel
                  events={visibleEvents}
                  selectedEventId={selectedEventId}
                  onSelectEvent={setSelectedEventId}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: persistent sidebar list of events in scope */}
        <aside className="hidden h-full min-h-0 w-80 shrink-0 overflow-hidden rounded-xl border border-default bg-surface p-3 shadow-sm lg:block">
          <h2 className="mb-2 text-sm font-semibold text-text">
            Parties in view ({visibleEvents.length})
          </h2>
          <div className="h-[calc(100%-2rem)] overflow-y-auto pr-1">
            <EventListPanel
              events={visibleEvents}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}