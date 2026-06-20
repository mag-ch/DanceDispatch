'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type CompactBadgeLike = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  tier: BadgeTier;
  sort_order?: number;
  sortOrder?: number;
  unlockedAt?: string;
};

type BadgeRow = CompactBadgeLike & { sort_order: number };

type UserBadgesInlineProps = {
  userId?: string | null;
  maxBadges?: number;
  className?: string;
  showNames?: boolean;
};

const badgesCache = new Map<string, BadgeRow[]>();

export const TIER_STYLES: Record<BadgeTier, string> = {
  bronze: 'border-amber-500/50 bg-amber-100 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300',
  silver: 'border-slate-400/60 bg-slate-100 text-slate-900 dark:bg-slate-400/10 dark:text-slate-300',
  gold: 'border-yellow-400/70 bg-yellow-100 text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-300',
  platinum: 'border-cyan-400/60 bg-cyan-100 text-cyan-900 dark:bg-cyan-400/10 dark:text-cyan-300',
};

type BadgeChipsInlineProps = {
  badges: CompactBadgeLike[];
  maxBadges?: number;
  className?: string;
  showNames?: boolean;
};

export function BadgeChipsInline({ badges, maxBadges = 2, className, showNames = true }: BadgeChipsInlineProps) {
  if (!Array.isArray(badges) || badges.length === 0) {
    return null;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      {badges.slice(0, maxBadges).map((badge) => (
        <span
          key={badge.id}
          title={badge.name}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${TIER_STYLES[badge.tier]}`}
        >
          <span aria-hidden>{badge.icon || '🏅'}</span>
          {showNames ? <span>{badge.name}</span> : null}
        </span>
      ))}
    </span>
  );
}

function normalizeTier(value: unknown): BadgeTier {
  if (value === 'silver' || value === 'gold' || value === 'platinum') {
    return value;
  }

  return 'bronze';
}

async function fetchUserBadges(userId: string, maxBadges: number): Promise<BadgeRow[]> {
  const cacheKey = `${userId}:${maxBadges}`;
  const cached = badgesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { data: unlockedRows, error: unlockedError } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
    .limit(maxBadges * 3);

  if (unlockedError || !unlockedRows || unlockedRows.length === 0) {
    return [];
  }

  const badgeIds = [...new Set(unlockedRows.map((row: any) => String(row.badge_id)).filter(Boolean))];
  if (badgeIds.length === 0) {
    return [];
  }

  const { data: badgeRows, error: badgesError } = await supabase
    .from('badges')
    .select('id, code, name, icon, tier, sort_order')
    .in('id', badgeIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (badgesError || !badgeRows) {
    return [];
  }

  const byId = new Map<string, BadgeRow>(
    (badgeRows as any[]).map((row) => [
      String(row.id),
      {
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        icon: typeof row.icon === 'string' ? row.icon : null,
        tier: normalizeTier(row.tier),
        sort_order: Number(row.sort_order ?? 0),
      },
    ])
  );

  const ordered = badgeIds.map((id) => byId.get(id)).filter((row): row is BadgeRow => Boolean(row)).slice(0, maxBadges);

  badgesCache.set(cacheKey, ordered);
  return ordered;
}

export default function UserBadgesInline({
  userId,
  maxBadges = 2,
  className,
  showNames = true,
}: UserBadgesInlineProps) {
  const [badges, setBadges] = useState<BadgeRow[]>([]);

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      setBadges([]);
      return;
    }

    fetchUserBadges(userId, maxBadges)
      .then((rows) => {
        if (isMounted) {
          setBadges(rows);
        }
      })
      .catch(() => {
        if (isMounted) {
          setBadges([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId, maxBadges]);

  const rendered = useMemo(() => {
    if (badges.length === 0) {
      return null;
    }

    return <BadgeChipsInline badges={badges} maxBadges={maxBadges} className={className} showNames={showNames} />;
  }, [badges, className, maxBadges, showNames]);

  return rendered;
}