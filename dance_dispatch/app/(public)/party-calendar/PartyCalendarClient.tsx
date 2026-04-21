"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Event } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

type PartyCalendarClientProps = {
  events: Event[];
};

type CalendarEvent = Event & {
  startAt: Date;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekdayIndexMondayFirst(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function parseEventStart(event: Event): Date {
  return new Date(`${event.startdate}T${event.starttime || "00:00"}`);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const dayStart = startOfDay(date);
  const dayOfWeek = weekdayIndexMondayFirst(dayStart);
  dayStart.setDate(dayStart.getDate() - dayOfWeek);
  return dayStart;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function humanTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function titleForRange(mode: ViewMode, date: Date): string {
  if (mode === "month") {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
  }

  if (mode === "day") {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekStart);
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(weekEnd);
  return `${startLabel} - ${endLabel}`;
}

export default function PartyCalendarClient({ events }: PartyCalendarClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [startFilter, setStartFilter] = useState<string>("");
  const [endFilter, setEndFilter] = useState<string>("");

  const normalizedEvents = useMemo<CalendarEvent[]>(() => {
    return events
      .map((event) => ({
        ...event,
        startAt: parseEventStart(event),
      }))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [events]);

  const rangeFilteredEvents = useMemo(() => {
    return normalizedEvents.filter((event) => {
      if (startFilter) {
        const startDate = new Date(`${startFilter}T00:00:00`);
        if (event.startAt < startDate) {
          return false;
        }
      }

      if (endFilter) {
        const endDate = new Date(`${endFilter}T23:59:59.999`);
        if (event.startAt > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [normalizedEvents, startFilter, endFilter]);

  const visibleRange = useMemo(() => {
    if (viewMode === "day") {
      const start = startOfDay(currentDate);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
      return { start, end };
    }

    if (viewMode === "week") {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    }

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return { start: startOfWeek(monthStart), end: addDays(startOfWeek(monthEnd), 6) };
  }, [currentDate, viewMode]);

  const visibleEvents = useMemo(() => {
    return rangeFilteredEvents.filter((event) => event.startAt >= visibleRange.start && event.startAt <= visibleRange.end);
  }, [rangeFilteredEvents, visibleRange]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of visibleEvents) {
      const key = formatYmd(event.startAt);
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }

    return map;
  }, [visibleEvents]);

  const dayCells = useMemo(() => {
    if (viewMode === "day") {
      return [startOfDay(currentDate)];
    }

    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate);
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }

    const monthStart = startOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [currentDate, viewMode]);

  const handlePeriodShift = (direction: -1 | 1) => {
    const next = new Date(currentDate);

    if (viewMode === "day") {
      next.setDate(next.getDate() + direction);
    } else if (viewMode === "week") {
      next.setDate(next.getDate() + direction * 7);
    } else {
      next.setMonth(next.getMonth() + direction);
    }

    setCurrentDate(next);
  };

  const emptyMessage = rangeFilteredEvents.length
    ? "No parties in this visible range."
    : "No parties match the selected date filters.";

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-xl border border-default bg-surface p-3 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full grid-cols-3 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                viewMode === "month" ? "border-accent bg-accent text-white" : "border-default hover-bg-accent-soft"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                viewMode === "week" ? "border-accent bg-accent text-white" : "border-default hover-bg-accent-soft"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                viewMode === "day" ? "border-accent bg-accent text-white" : "border-default hover-bg-accent-soft"
              }`}
            >
              Day
            </button>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center">
            <button
              type="button"
              onClick={() => handlePeriodShift(-1)}
              className="rounded-md border border-default px-3 py-2 text-sm font-medium hover-bg-accent-soft"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="rounded-md border border-default px-3 py-2 text-sm font-medium hover-bg-accent-soft"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePeriodShift(1)}
              className="rounded-md border border-default px-3 py-2 text-sm font-medium hover-bg-accent-soft"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <p className="text-base font-semibold md:text-lg">{titleForRange(viewMode, currentDate)}</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-end md:gap-3">
            <label className="flex flex-col text-sm">
              Start Date
              <input
                type="date"
                value={startFilter}
                onChange={(event) => setStartFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-default bg-surface px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm">
              End Date
              <input
                type="date"
                value={endFilter}
                onChange={(event) => setEndFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-default bg-surface px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setStartFilter("");
                setEndFilter("");
              }}
              className="rounded-md border border-default px-3 py-2 text-sm font-medium hover-bg-accent-soft sm:col-span-2 md:col-span-1"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {viewMode !== "day" && (
        <div className="hidden gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted lg:grid lg:grid-cols-7">
          {weekdayLabels.map((day) => (
            <div key={day} className="rounded-md bg-surface p-2 border border-default">
              {day}
            </div>
          ))}
        </div>
      )}

      <div className={viewMode === "month" ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7"}>
        {dayCells.map((day) => {
          const key = formatYmd(day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const inCurrentMonth = day.getMonth() === currentDate.getMonth();

          return (
            <div
              key={key}
              className={`min-h-[120px] rounded-lg border p-2 sm:min-h-[140px] ${
                sameDay(day, new Date()) ? "border-accent" : "border-default"
              } ${viewMode === "month" && !inCurrentMonth ? "opacity-45" : ""} bg-surface`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {viewMode !== "day" && (
                    <span className="mr-1 text-xs text-muted lg:hidden">{weekdayLabels[weekdayIndexMondayFirst(day)]}</span>
                  )}
                  {day.getDate()}
                </p>
                <p className="text-xs text-muted">{new Intl.DateTimeFormat("en-US", { month: "short" }).format(day)}</p>
              </div>

              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const image = event.imageurl || "/images/default_event.jpg";
                  const showExpandedPreview = viewMode !== "month";
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className={`block rounded-md border border-default hover:border-accent transition ${
                        showExpandedPreview ? "p-2" : "p-1.5"
                      }`}
                    >
                      <div className={`flex ${showExpandedPreview ? "items-start gap-3" : "gap-2"}`}>
                        <img
                          src={image}
                          alt={event.title}
                          className={showExpandedPreview ? "h-16 w-16 rounded object-cover" : "h-12 w-12 rounded-sm object-cover"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`${showExpandedPreview ? "text-sm" : "text-xs"} truncate font-semibold`}>{event.title}</p>
                          <p className={`${showExpandedPreview ? "text-xs" : "text-[11px]"} text-muted`}>{humanTime(event.startAt)}</p>
                          {showExpandedPreview && (
                            <>
                              <p className="truncate text-xs text-muted">{event.location}</p>
                              {event.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted">{event.description}</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {!dayEvents.length && <p className="text-xs text-muted">No events</p>}
              </div>
            </div>
          );
        })}
      </div>

      {!visibleEvents.length && (
        <div className="rounded-lg border border-default bg-surface p-5 text-sm text-muted">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
