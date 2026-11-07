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

function startOfWeek(date: Date): Date {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  return weekStart;
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

type DatedItem = { event: Event; card: ReactNode };

function DateSection({ title, items }: { title: string; items: DatedItem[] }) {
  return (
    <section className="mb-8">
      {/* top-16 keeps the header below the sticky site header */}
      <h3 className="sticky top-16 z-40 mb-4 border-b border-default bg-bg py-2 text-lg font-semibold">
        {title}
      </h3>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map(({ event, card }) => <div key={event.id}>{card}</div>)}
      </div>
    </section>
  );
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
  const [showUpcoming, setShowUpcoming] = useState(false);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const dayAfterTomorrow = new Date(todayStart);
  dayAfterTomorrow.setDate(todayStart.getDate() + 2);
  // Exclusive end of the current week (the Monday after this Sunday)
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(todayStart.getDate() + ((8 - todayStart.getDay()) % 7 || 7));

  const today: DatedItem[] = [];
  const tomorrow: DatedItem[] = [];
  const laterThisWeek: DatedItem[] = [];
  const upcoming: DatedItem[] = [];
  visibleCards.forEach((item) => {
    const day = localDay(item.event.startdate).getTime();
    if (day < todayStart.getTime()) return;
    if (day < tomorrowStart.getTime()) today.push(item);
    else if (day < dayAfterTomorrow.getTime()) tomorrow.push(item);
    else if (day < weekEnd.getTime()) laterThisWeek.push(item);
    else upcoming.push(item);
  });

  const upcomingWeeks = new Map<number, DatedItem[]>();
  upcoming.forEach((item) => {
    const weekStart = startOfWeek(localDay(item.event.startdate)).getTime();
    const weekItems = upcomingWeeks.get(weekStart) ?? [];
    weekItems.push(item);
    upcomingWeeks.set(weekStart, weekItems);
  });
  const weekTitleFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const groupedUpcoming = [...upcomingWeeks.entries()]
    .sort(([firstWeek], [secondWeek]) => firstWeek - secondWeek)
    .map(([weekStart, items]) => ({
      key: weekStart,
      title: `Week of ${weekTitleFormatter.format(new Date(weekStart))}`,
      items,
    }));

  const sections = [
    { key: 'today', title: 'Today', items: today },
    { key: 'tomorrow', title: 'Tomorrow', items: tomorrow },
    { key: 'week', title: 'Later This Week', items: laterThisWeek },
  ].filter((section) => section.items.length > 0);

  return (
    <>
      <div className="mb-8 flex gap-2 mt-5 overflow-x-auto pb-1" aria-label="Filter events">
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
        <>
          {sections.map((section) => (
            <DateSection key={section.key} title={section.title} items={section.items} />
          ))}
          {upcoming.length > 0 && !showUpcoming && (
            <div className="my-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowUpcoming(true)}
                className="rounded-full border border-default bg-surface px-6 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-text"
              >
                See more
              </button>
            </div>
          )}
          {upcoming.length > 0 && showUpcoming && (
            groupedUpcoming.map((week) => (
              <DateSection key={week.key} title={week.title} items={week.items} />
            ))
          )}
        </>
      )}
    </>
  );
}