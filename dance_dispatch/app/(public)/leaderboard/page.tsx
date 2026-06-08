'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Star, Share2, CalendarCheck, MessageSquare, Users, Radio } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { BadgeChipsInline } from '@/app/components/UserBadgesInline';

type CompactBadge = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  sortOrder: number;
  unlockedAt: string;
};

type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  breakdown: Record<string, number>;
  topBadges?: CompactBadge[];
};

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  rsvp:     { label: 'RSVPs',    icon: <CalendarCheck className="h-3.5 w-3.5" /> },
  share:    { label: 'Shares',   icon: <Share2 className="h-3.5 w-3.5" /> },
  review:   { label: 'Reviews',  icon: <MessageSquare className="h-3.5 w-3.5" /> },
  referral: { label: 'Referrals',icon: <Users className="h-3.5 w-3.5" /> },
};

const RANK_COLORS = ['text-yellow-400', 'text-slate-400', 'text-amber-600'];
const RANK_BG    = ['bg-yellow-50 dark:bg-yellow-900/20', 'bg-slate-50 dark:bg-slate-800/30', 'bg-amber-50 dark:bg-amber-900/20'];

export default function LeaderboardPage() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const referralLink = session?.user?.id ? `/auth/signup?ref=${encodeURIComponent(session.user.id)}` : '/auth/login';

  useEffect(() => {
    let isMounted = true;

    const loadLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard?limit=50', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();
        if (!isMounted) return;

        setEntries(data.leaderboard ?? []);
        setLastUpdated(new Date());
        setError(null);
      } catch {
        if (!isMounted) return;
        setError('Could not load the leaderboard right now.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLeaderboard();
    const intervalId = window.setInterval(loadLeaderboard, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-200">
          <Radio className="h-3.5 w-3.5" />
          Live updates every 30s
        </div>
        <Trophy className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted mt-2 text-sm">
          Earn points by saving events, sharing with friends, writing reviews, and referring new dancers.
        </p>
        {lastUpdated && (
          <p className="mt-3 text-xs text-muted">
            Last updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Points legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { action: 'rsvp',     pts: 10,  desc: 'Save an event' },
          { action: 'share',    pts: 5,   desc: 'Per friend shared' },
          { action: 'review',   pts: 20,  desc: 'Write a review' },
          { action: 'referral', pts: 50,  desc: 'Refer a new user' },
        ].map(({ action, pts, desc }) => (
          <div key={action} className="bg-surface rounded-xl p-4 text-center shadow-sm">
            <div className="flex justify-center mb-1 text-muted">
              {ACTION_LABELS[action].icon}
            </div>
            <div className="text-xl font-bold text-text">+{pts}</div>
            <div className="text-xs text-muted">{desc}</div>
          </div>
        ))}
      </div>

      {/* How to refer — copyable link hint */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-8 text-sm text-muted">
        <strong className="text-text">Refer a friend:</strong> Share your signup link{' '}
        <code className="bg-bg px-1 rounded text-xs">{referralLink}</code>{' '}
        {session?.user?.id ? (
          <>and earn <strong className="text-text">50 points</strong> when they join.</>
        ) : (
          <>log in to generate your personal referral link.</>
        )}
      </div>

      {/* Table */}
      {loading && (
        <div className="text-center text-muted py-16">Loading…</div>
      )}
      {error && (
        <div className="text-center text-red-500 py-16">{error}</div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center text-muted py-16">No points earned yet — be the first!</div>
      )}
      {!loading && !error && entries.length > 0 && (
        <ol className="space-y-3">
          {entries.map((entry) => {
            const isTop3 = entry.rank <= 3;
            return (
              <li
                key={entry.userId}
                className={`flex items-center gap-4 rounded-xl px-4 py-3 border border-border shadow-sm ${isTop3 ? RANK_BG[entry.rank - 1] : 'bg-surface'}`}
              >
                {/* Rank */}
                <span className={`w-7 text-center font-bold text-lg ${isTop3 ? RANK_COLORS[entry.rank - 1] : 'text-muted'}`}>
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </span>

                {/* Avatar */}
                <div className="h-9 w-9 rounded-full overflow-hidden bg-bg flex-shrink-0 border border-border">
                  {entry.avatarUrl ? (
                    <Image src={entry.avatarUrl} alt={entry.username} width={36} height={36} className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm font-semibold text-muted">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Username */}
                <div className="flex-1 min-w-0">
                  <Link href={`/users/${entry.userId}`} className="font-semibold text-text hover:underline truncate inline-flex items-center gap-2">
                    <span>{entry.username}</span>
                    {Array.isArray(entry.topBadges) && entry.topBadges.length > 0 ? <BadgeChipsInline badges={entry.topBadges} maxBadges={2} showNames /> : null}
                  </Link>
                  {/* Breakdown chips */}
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {Object.entries(entry.breakdown).map(([action, pts]) => (
                      <span
                        key={action}
                        className="inline-flex items-center gap-0.5 bg-bg text-muted rounded-full px-2 py-0.5 text-xs border border-border"
                      >
                        {ACTION_LABELS[action]?.icon}
                        {ACTION_LABELS[action]?.label ?? action}: {pts}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Total points */}
                <div className="flex items-center gap-1 font-bold text-text text-lg flex-shrink-0">
                  <Star className={`h-4 w-4 ${isTop3 ? RANK_COLORS[entry.rank - 1] : 'text-muted'}`} />
                  {entry.totalPoints.toLocaleString()}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
