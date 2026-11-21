'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CalendarDays, Swords, Trophy, X } from 'lucide-react';

export type AllTimeEventRanking = {
  eventId: string;
  title: string;
  subtitle: string;
  date: string;
  imageUrl?: string;
  rank: number;
  wins: number;
  losses: number;
  score: number;
};

type Props = {
  rankings: AllTimeEventRanking[];
};

export default function AllTimeEventRankingsButton({ rankings }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex w-fit btn-highlighted items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <Trophy className="h-4 w-4" />
        View Event Rankings
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close event rankings"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-time-event-rankings-title"
            className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-default bg-surface text-text shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-default px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="all-time-event-rankings-title" className="font-bold">
                    All-Time Event Rankings
                  </h2>
                  <p className="text-xs text-muted">Your party matchups, across all weeks</p>
                </div>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setIsOpen(false)}
                aria-label="Close event rankings"
                className="rounded-lg p-2 text-muted transition hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="overflow-y-auto p-4">
              {rankings.length === 0 ? (
                <div className="py-10 text-center">
                  <Swords className="mx-auto h-8 w-8 text-amber-500" />
                  <p className="mt-3 font-semibold">No ranked parties yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Complete Event Match Ups to build your all-time ranking.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {rankings.map((ranking) => (
                    <li
                      key={ranking.eventId}
                      className="flex items-center gap-3 rounded-xl border border-default bg-bg p-3"
                    >
                      <span className="w-7 shrink-0 text-center text-sm font-extrabold text-amber-500">
                        {ranking.rank}
                      </span>
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                        {ranking.imageUrl ? (
                          <Image
                            src={ranking.imageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <CalendarDays className="m-auto h-5 w-5 text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{ranking.title}</p>
                        <p className="truncate text-xs text-muted">
                          {ranking.subtitle} · {ranking.date}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold">
                          {ranking.score > 0 ? '+' : ''}{ranking.score}
                        </p>
                        <p className="text-[10px] text-muted">
                          {ranking.wins}W · {ranking.losses}L
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
