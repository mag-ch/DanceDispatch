'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Swords,
  X,
  Check,
  Loader2,
  Trophy,
  RotateCcw,
  Star,
  Sparkles,
} from 'lucide-react';
import { saveEventComparison, updateEventComparison } from '@/lib/saveEventComparisons';

export type ModalEvent = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  date: string;
};

export type ModalComparison = {
  id: string;
  eventA: ModalEvent;
  eventB: ModalEvent;
  winnerId: string;
};

export type ModalRanking = {
  eventId: string;
  rank: number;
  score: number;
};

type Props = {
  initialMatchup: [ModalEvent, ModalEvent] | null;
  remainingPairs: [ModalEvent, ModalEvent][];
  comparisons: ModalComparison[];
  rankings: ModalRanking[];
  reviewableEvents: ModalEvent[];
  attendedEvents: ModalEvent[];
};

const SESSION_KEY = 'event-ranking-modal-shown';

export function EventRankingModal({
  initialMatchup,
  remainingPairs: initialRemaining,
  comparisons: initialComparisons,
  attendedEvents,
  reviewableEvents,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMatchup, setCurrentMatchup] = useState(initialMatchup);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [comparisons, setComparisons] = useState(initialComparisons);
  const [activeTab, setActiveTab] = useState<'matchup' | 'history' | 'rankings'>('matchup');
  const [voting, setVoting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Auto-open on first view of each new session
  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (!alreadyShown && initialMatchup) {
      setIsOpen(true);
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
  }, [initialMatchup]);

  // Auto-close after vote recorded
  useEffect(() => {
    if (justVoted) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      const timer = setTimeout(() => {
        setIsOpen(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [justVoted]);

  const eventMap = useMemo(() => {
    const map = new Map<string, ModalEvent>();
    attendedEvents.forEach((e) => map.set(e.id, e));
    return map;
  }, [attendedEvents]);

  const localRankings = useMemo(() => {
    const scores = new Map<string, number>();
    comparisons.forEach((c) => {
      const loserId = c.winnerId === c.eventA.id ? c.eventB.id : c.eventA.id;
      scores.set(c.winnerId, (scores.get(c.winnerId) || 0) + 1);
      scores.set(loserId, (scores.get(loserId) || 0) - 1);
    });
    return [...scores.entries()]
      .map(([eventId, score]) => ({
        eventId,
        score,
        event: eventMap.get(eventId)!,
        rank: 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [comparisons, eventMap]);

  const handleVote = useCallback(
    async (winnerId: string) => {
      if (!currentMatchup || voting) return;
      setVoting(true);

      const [eventA, eventB] = currentMatchup;
      const result = await saveEventComparison(eventA.id, eventB.id, winnerId);

      if (result.success) {
        setIsOpen(false);

        setComparisons((prev) => [
          ...prev,
          {
            id: result.comparisonId ?? `temp-${Date.now()}`,
            eventA,
            eventB,
            winnerId,
          },
        ]);
        setRemaining((prev) =>
          prev.filter(
            (pair) =>
              !(
                (pair[0].id === eventA.id && pair[1].id === eventB.id) ||
                (pair[0].id === eventB.id && pair[1].id === eventA.id)
              )
          )
        );
        setCurrentMatchup(null);
        setJustVoted(true);
      }

      setVoting(false);
    },
    [currentMatchup, voting]
  );

  const handleNextMatchup = useCallback(() => {
    if (remaining.length === 0) return;
    const next = remaining[Math.floor(Math.random() * remaining.length)];
    setCurrentMatchup(next);
    setJustVoted(false);
  }, [remaining]);

  const handleUpdateComparison = useCallback(
    async (comp: ModalComparison, newWinnerId: string) => {
      if (comp.id.startsWith('temp-')) return;
      setUpdatingId(comp.id);
      const result = await updateEventComparison(
        comp.id,
        newWinnerId,
        comp.eventA.id,
        comp.eventB.id
      );
      if (result.success) {
        setComparisons((prev) =>
          prev.map((c) => (c.id === comp.id ? { ...c, winnerId: newWinnerId } : c))
        );
      }
      setUpdatingId(null);
    },
    []
  );

  const handleManualClose = useCallback(() => {
    setIsOpen(false);
    sessionStorage.setItem(SESSION_KEY, 'true');
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 transition-all"
      >
        <Swords className="w-4 h-4 text-amber-400" />
        <span>Event Match Ups</span>
        {remaining.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-400 rounded-full">
            {remaining.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleManualClose}
      />

      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
              <Swords className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">Event Match Ups</h2>
          </div>
          <button
            onClick={handleManualClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          {(['matchup', 'history', 'rankings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'matchup' && 'Match Up'}
              {tab === 'history' && `History (${comparisons.length})`}
              {tab === 'rankings' && 'Rankings'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {activeTab === 'matchup' && (
            <div className="p-5">
              {justVoted && currentMatchup === null ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
                    <Check className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-semibold mb-6 text-zinc-100">Vote recorded</h3>
                  
                    {remaining.length > 0
                      ? <button
                      onClick={handleNextMatchup}
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-semibold transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Next Matchup
                    </button>
                      :
                      <div>
                      <p>That's all for this week!</p>
                      <Link
            href="/search?includePast=true"
            className="w-full sm:w-auto text-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20"
          >
            Review a past event to add it to your RSVPs and unlock more matchups
          </Link>
          </div>
                      }
                 
                </div>
              ) : currentMatchup ? (
                <div>
                  <p className="text-center text-xs text-zinc-500 mb-4">
                    {remaining.length} remaining this week
                  </p>
                  <div className="flex items-stretch gap-3">
                    {[currentMatchup[0], currentMatchup[1]].map((event, idx) => (
                      <button
                        key={event.id}
                        onClick={() => handleVote(event.id)}
                        disabled={voting}
                        className={`
                          group relative flex-1 rounded-xl border transition-all duration-200 text-left
                          border-zinc-800 bg-zinc-900 hover:border-amber-500/40 hover:bg-zinc-800/60
                          ${voting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-zinc-800">
                          {event.imageUrl ? (
                            <Image
                              src={event.imageUrl}
                              alt={event.title}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="200px"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-800" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-zinc-100 line-clamp-2">
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 truncate">
                            {event.subtitle}
                          </p>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 text-white backdrop-blur-sm">
                            {idx === 0 ? 'A' : 'B'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-center">
                    <span className="text-[10px] font-black text-zinc-600 italic tracking-widest">
                      VS
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-zinc-800 text-zinc-500 mb-4">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100">All caught up</h3>
                  <p className="mt-1 text-sm text-zinc-400 max-w-xs mx-auto">
                    You've ranked all your events this week. Come back next week for fresh
                    matchups.
                  </p>

                  {reviewableEvents.length > 0 && (
                    <div className="mt-6 text-left">
                      <p className="text-xs font-medium text-zinc-400 mb-3 px-1">
                        Review past events to add them to your RSVPs and unlock more matchups:
                      </p>
                      <div className="space-y-2">
                        {reviewableEvents.slice(0, 5).map((event) => (
                          <Link
                            key={event.id}
                            href={`/events/${event.id}?showReviewModal=true`}
                            onClick={handleManualClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-md bg-zinc-800 shrink-0 overflow-hidden relative">
                              {event.imageUrl && (
                                <Image
                                  src={event.imageUrl}
                                  alt={event.title}
                                  fill
                                  className="object-cover"
                                  sizes="32px"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-zinc-200 truncate">
                                {event.title}
                              </p>
                              <p className="text-xs text-zinc-500 truncate">
                                {event.subtitle}
                              </p>
                            </div>
                            <Star className="w-4 h-4 text-zinc-600" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-5 space-y-3">
              {comparisons.length === 0 ? (
                <p className="text-center text-sm text-zinc-500 py-8">
                  No matchups yet this week.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-center text-zinc-500 uppercase tracking-wider">
                    Tap the loser to change your vote
                  </p>
                  {comparisons.map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-xl p-3"
                    >
                      <div className="flex items-center gap-2">
                        {/* Event A — fixed 50% width */}
                        <button
                          onClick={() =>
                            comp.winnerId !== comp.eventA.id &&
                            handleUpdateComparison(comp, comp.eventA.id)
                          }
                          disabled={updatingId === comp.id || comp.id.startsWith('temp-')}
                          className={`w-1/2 text-left rounded-lg p-2.5 transition-colors min-w-0 ${
                            comp.winnerId === comp.eventA.id
                              ? 'btn-highlighted border border-amber-500/20'
                              : 'bg-zinc-800/40 hover:bg-zinc-800 border border-transparent'
                          }`}
                        >
                          <p
                            className={`text-xs font-medium truncate ${
                              comp.winnerId === comp.eventA.id
                                ? 'text-amber-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            {comp.eventA.title}
                          </p>
                        </button>

                        <span className="shrink-0 text-[10px] font-black text-zinc-600 italic">
                          VS
                        </span>

                        {/* Event B — fixed 50% width */}
                        <button
                          onClick={() =>
                            comp.winnerId !== comp.eventB.id &&
                            handleUpdateComparison(comp, comp.eventB.id)
                          }
                          disabled={updatingId === comp.id || comp.id.startsWith('temp-')}
                          className={`w-1/2 text-left rounded-lg p-2.5 transition-colors min-w-0 ${
                            comp.winnerId === comp.eventB.id
                              ? 'btn-highlighted border border-amber-500/20'
                              : 'bg-zinc-800/40 hover:bg-zinc-800 border border-transparent'
                          }`}
                        >
                          <p
                            className={`text-xs font-medium truncate ${
                              comp.winnerId === comp.eventB.id
                                ? 'text-amber-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            {comp.eventB.title}
                          </p>
                        </button>
                      </div>

                      {updatingId === comp.id && (
                        <p className="mt-2 text-[10px] text-zinc-600 text-center">
                          <span className="flex items-center justify-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Updating...
                          </span>
                        </p>
                      )}
                      {comp.id.startsWith('temp-') && (
                        <p className="mt-2 text-[10px] text-zinc-600 text-center">
                          Refresh the page to edit this vote
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'rankings' && (
            <div className="p-5">
              {localRankings.length === 0 ? (
                <p className="text-center text-sm text-zinc-500 py-8">
                  Complete some matchups to see your rankings.
                </p>
              ) : (
                <div className="space-y-2">
                  {localRankings.map((r, idx) => (
                    <div
                      key={r.eventId}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                        idx === 0
                          ? 'bg-amber-500/5 border border-amber-500/10'
                          : 'bg-zinc-900/50 border border-zinc-800/50'
                      }`}
                    >
                      <div
                        className={`
                          flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold shrink-0
                          ${idx === 0 ? 'bg-amber-500/15 text-amber-400' : ''}
                          ${idx === 1 ? 'bg-zinc-500/15 text-zinc-300' : ''}
                          ${idx === 2 ? 'bg-orange-500/15 text-orange-400' : ''}
                          ${idx > 2 ? 'bg-zinc-800 text-zinc-500' : ''}
                        `}
                      >
                        {idx === 0 ? <Sparkles className="w-3 h-3" /> : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {r.event.title}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {r.event.subtitle}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-mono ${
                          r.score > 0 ? 'text-emerald-400' : r.score < 0 ? 'text-red-400' : 'text-zinc-500'
                        }`}
                      >
                        {r.score > 0 ? `+${r.score}` : r.score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}