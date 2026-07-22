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
        className="w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-semibold text-purple-300 hover:text-purple-200 transition-all shadow-lg"
      >
        <Calendar className="w-4 h-4" />
        <span>Review recent parties</span>
        {unreviewedCount > 0 && (
          <span className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/20">
            {unreviewedCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <section className="container overflow-hidden">
      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Announcement
          </p>
          <h2 className="mt-1.5 text-2xl font-bold text-zinc-100 leading-tight">
            {header}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {savedCount > 0
              ? `${savedCount} saved · ${unreviewedCount > 0 ? `${unreviewedCount} need review` : 'all reviewed'}`
              : `${events.length} parties this week`}
          </p>
        </div>
        <button
          onClick={handleToggleCollapse}
          className="shrink-0 self-start p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
          aria-label="Collapse section"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Events */}
      <div className="relative mt-5 space-y-5">
        {Object.entries(grouped).map(([dayHeading, dayEvents]) => (
          <div key={dayHeading}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500 mb-3">
              {dayHeading}
            </h3>
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <Link
                  key={event.id}
                  href={event.href}
                  className={`
                    group flex items-center gap-3 rounded-lg border px-4 py-3 transition-all
                    ${event.needsReview
                      ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40'
                      : 'border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700'
                    }
                  `}
                >
                  {/* Thumbnail */}
                  <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden ">
                    {event.imageUrl ? (
                      <Image
                        src={event.imageUrl}
                        alt={event.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  {event.isSaved && (
                        <BookmarkCheck className="w-5 h-5 text-text shrink-0" />
                      )}
                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    
                    <div className="flex items-center gap-2">
                      
                      <span className="text-sm font-semibold text-text group-hover:text-purple-300 transition-colors truncate">
                        {event.title}
                      </span>
                    </div>
                    <span className="mt-0.5 block text-xs text-zinc-500 truncate">
                      {event.subtitle}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="shrink-0 flex items-center gap-2">
                    {event.needsReview ? (
                      <>
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          <Pencil className="w-3 h-3" />
                          Review
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                      </>
                    ) : (
                      <>
                        {event.isSaved && (
                          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Saved
                          </span>
                        )}
                        <span className="text-xs font-medium text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Review
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-purple-400 transition-colors" />
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative mt-4 flex flex-col sm:flex-row items-center gap-3">
        {hasMore && (
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="w-full sm:w-auto flex items-center justify-center gap-2  px-4 py-2.5 text-sm font-semibold  transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show fewer
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                See more recent events
              </>
            )}
          </button>
        )}

        <Link
          href="/search?includePast=true"
          className="w-full sm:w-auto text-center rounded-lg border-rounded border px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-purple-900/20"
        >
          Browse all past events
        </Link>
      </div>
    </section>
  );
}