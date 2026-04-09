'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Trophy, X } from 'lucide-react';

type MissionStatus = {
  savedEvent: boolean;
  followedHost: boolean;
  followedVenue: boolean;
  followedUser: boolean;
  wroteReview: boolean;
};

type ExplorerBadgeModalProps = {
  missionStatus: MissionStatus;
};

export default function ExplorerBadgeModal({ missionStatus }: ExplorerBadgeModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const missions = useMemo(
    () => [
      { complete: missionStatus.savedEvent, label: 'Discover the Floor - Save your first event' },
      { complete: missionStatus.followedHost, label: 'Find Your Vibe - Follow your first DJ' },
      { complete: missionStatus.followedVenue, label: 'Support Your Spot - Follow your first venue' },
      { complete: missionStatus.followedUser, label: 'Connect with Friends - Follow your first user' },
      { complete: missionStatus.wroteReview, label: 'Share Your Story - Write your first review' },
    ],
    [missionStatus]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 rounded-xl border border-yellow-400/40 bg-surface px-4 py-3 text-left hover:border-yellow-400"
        aria-label="Open Explorer Badge mission details"
      >
        <Trophy className="h-6 w-6 shrink-0 text-yellow-500" />
        <div>
          <p className="font-semibold text-text">Explorer Badge</p>
          <p className="text-sm text-muted">Unlocked - click to view mission activity</p>
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-8"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-default bg-surface p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Explorer Badge missions"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Achievement Details</p>
                <h2 className="text-xl font-semibold text-text">Explorer Badge Missions</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close Explorer Badge mission modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="space-y-3">
              {missions.map((mission) => (
                <li key={mission.label} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-text">{mission.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
