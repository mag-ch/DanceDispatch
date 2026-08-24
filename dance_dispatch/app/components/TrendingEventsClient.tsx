"use client";

import { ReactNode, useState } from "react";
import type { Event } from "@/lib/utils";

const BASE_MISSION_FILTERS = ['All', 'Today', 'This Weekend', 'Free'] as const;
type MissionFilter = (typeof BASE_MISSION_FILTERS)[number] | string;

function getMissionFilters(events: Event[]): string[] {
  const genreCounts = new Map<string, { label: string; count: number; firstSeen: number }>();

  events.forEach((event) => {
    const seenForEvent = new Set<string>();
    (event.hostGenres ?? []).forEach((genre) => {
      const label = String(genre).trim();
      const normalized = label.toLowerCase();
      if (!label || seenForEvent.has(normalized)) return;

      seenForEvent.add(normalized);
      const existing = genreCounts.get(normalized);
      genreCounts.set(normalized, {
        label: existing?.label ?? label,
        count: (existing?.count ?? 0) + 1,
        firstSeen: existing?.firstSeen ?? genreCounts.size,
      });
    });
  });

  return [
    ...BASE_MISSION_FILTERS,
    ...[...genreCounts.values()]
      .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen)
      .slice(0, 5)
      .map(({ label }) => label),
  ];
}

function localDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function eventMatchesMission(event: Event, filter: MissionFilter): boolean {
  if (filter === 'All') return true;

  const eventDay = localDay(event.startdate);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (filter === 'Today') return eventDay.getTime() === todayStart.getTime();

  if (filter === 'This Weekend') {
    const daysUntilSaturday = (6 - todayStart.getDay() + 7) % 7;
    const weekendStart = new Date(todayStart);
    weekendStart.setDate(todayStart.getDate() + daysUntilSaturday);
    const weekendEnd = new Date(weekendStart);
    weekendEnd.setDate(weekendStart.getDate() + 1);
    return eventDay >= weekendStart && eventDay <= weekendEnd;
  }

  const searchableText = `${event.title} ${event.description} ${(event.hostGenres ?? []).join(' ')}`.toLowerCase();
  if (filter === 'Free') return Number(event.price) === 0 || searchableText.includes('free');
  return searchableText.includes(filter.toLowerCase());
}

export default function TrendingEventsClient({
  events,
  initialFilter,
  cards,
}: {
  events: Event[];
  initialFilter: MissionFilter;
  cards: ReactNode[];
}) {
  const [filter, setFilter] = useState<MissionFilter>(initialFilter);
  const missionFilters = getMissionFilters(events);
  const visibleCards = events
    .map((event, index) => ({ event, card: cards[index] }))
    .filter(({ event }) => eventMatchesMission(event, filter));

  return (
    <>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-1" aria-label="Filter events">
        {missionFilters.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === option
                ? 'border-accent bg-accent text-white shadow-sm'
                : 'border-default bg-surface text-muted hover:border-accent hover:text-text'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-semibold">Choose your next mission!</h2>
        <p className="text-sm text-muted">{filter === 'All' ? 'Upcoming events' : `${filter} events`}</p>
      </div>
      {visibleCards.length === 0 ? (
        <p className="text-muted">No events match this mission yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">{visibleCards.map(({ event, card }) => <div key={event.id}>{card}</div>)}</div>
      )}
    </>
  );
}