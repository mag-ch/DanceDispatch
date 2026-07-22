'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  X,
  BookmarkCheck,
  Calendar,
  ArrowRight,
  Pencil,
} from 'lucide-react';

export type AnnouncementEvent = {
  id: string;
  title: string;
  subtitle: string;
  dayHeading: string;
  href: string;
  startdate: string;
  isSaved: boolean;
  imageUrl?: string;
  needsReview: boolean;
};

type Props = {
  header: string;
  events: AnnouncementEvent[];
  initialLimit: number;
  expandedLimit: number;
  totalCount: number;
  savedCount: number;
  unreviewedCount: number;
};

export function LandingAnnouncementClient({
  header,
  events,
  initialLimit,
  expandedLimit,
  totalCount,
  savedCount,
  unreviewedCount,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('landing-announcement-collapsed') === 'true';
  });

  const limit = isExpanded ? expandedLimit : initialLimit;
  const visibleEvents = events.slice(0, limit);
  const hasMore = events.length > limit || totalCount >= events.length;

  const handleToggleCollapse = useCallback(() => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('landing-announcement-collapsed', String(next));
  }, [isCollapsed]);

  const grouped = visibleEvents.reduce<Record<string, AnnouncementEvent[]>>((acc, evt) => {
    if (!acc[evt.dayHeading]) acc[evt.dayHeading] = [];
    acc[evt.dayHeading].push(evt);
    return acc;
  }, {});

  if (isCollapsed) {
    return (
      <button
        onClick={handleToggleCollapse}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-purple-300 hover:text-purple-200 transition-all"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>Review recent parties</span>
        {unreviewedCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-full">
            {unreviewedCount}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <section className="container overflow-hidden">
      {/* Compact header */}
      <div className="relative flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Announcement
          </p>
          <h2 className="mt-0.5 text-base sm:text-xl font-bold text-zinc-100 leading-tight truncate">
            {header}
          </h2>
          <p className="text-[11px] text-zinc-500 truncate">
            {savedCount > 0
              ? `${savedCount} saved · ${unreviewedCount > 0 ? `${unreviewedCount} need review` : 'all reviewed'}`
              : `${events.length} parties this week`}
          </p>
        </div>
        <button
          onClick={handleToggleCollapse}
          className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
          aria-label="Collapse section"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Condensed events */}
      <div className="relative mt-2 space-y-3">
        {Object.entries(grouped).map(([dayHeading, dayEvents]) => (
          <div key={dayHeading}>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 mb-1">
              {dayHeading}
            </h3>
            <div className="space-y-1">
              {dayEvents.map((event) => (
                <Link
                  key={event.id}
                  href={event.href}
                  className={`
                    group flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-all
                    ${event.needsReview
                      ? 'border-amber-500/25 bg-amber-500/[0.03] hover:bg-amber-500/8'
                      : 'border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/40'
                    }
                  `}
                >
                  {/* Tiny thumbnail */}
                  <div className="relative shrink-0 w-8 h-8 rounded-md overflow-hidden bg-zinc-800">
                    {event.imageUrl ? (
                      <Image
                        src={event.imageUrl}
                        alt={event.title}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {/* Text — single line */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {event.isSaved && (
                        <BookmarkCheck className="w-3 h-3 text-purple-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-zinc-200 group-hover:text-purple-300 transition-colors truncate">
                        {event.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 truncate block leading-tight">
                      {event.subtitle}
                    </span>
                  </div>

                  {/* Meta — minimal */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {event.needsReview ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-400">
                        <Pencil className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">Review</span>
                      </span>
                    ) : event.isSaved ? (
                      <span className="hidden sm:inline text-[10px] text-purple-400/60">Saved</span>
                    ) : null}
                    <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-purple-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Compact footer */}
      <div className="relative mt-2 flex items-center gap-2">
        {hasMore && (
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Fewer
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                More
              </>
            )}
          </button>
        )}

        <Link
          href="/search?includePast=true"
          className="ml-auto text-[11px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
        >
          Browse all →
        </Link>
      </div>
    </section>
  );
}