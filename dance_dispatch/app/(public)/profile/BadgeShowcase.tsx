'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import UserBadgesInline, { clearBadgesCache } from '@/app/components/UserBadgesInline';

type ModalBadge = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  requirementType: string | null;
  minValue: number | null;
};

type BadgeState = {
  badges: ModalBadge[];
  unlocked: Set<string>;
  activeId: string | null;
};

const SECTION_LABELS: Record<string, string> = {
  rsvps_count: 'RSVPs',
  reviews_count: 'Reviews',
  share_count: 'Shares',
  referrals_count: 'Referrals',
  submit_event_count: 'Event Submissions',
};

const sectionLabel = (type: string | null) =>
  type ? SECTION_LABELS[type] ?? type.replace(/_/g, ' ') : 'Special';

export default function BadgeShowcase({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BadgeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [badgesRes, reqRes, userRes] = await Promise.all([
      supabase.from('badges').select('id, name, icon, sort_order').eq('is_active', true),
      supabase.from('badge_requirements').select('badge_id, requirement_type, min_value'),
      supabase.from('user_badges').select('badge_id, active').eq('user_id', userId),
    ]);
    setLoading(false);

    if (badgesRes.error || userRes.error) {
      setError('Could not load badges.');
      return;
    }

    const reqs = new Map<string, { type: string | null; min: number | null }>();
    for (const r of (reqRes.data ?? []) as any[]) {
      if (!reqs.has(String(r.badge_id))) {
        reqs.set(String(r.badge_id), {
          type: r.requirement_type ?? null,
          min: r.min_value === null || r.min_value === undefined ? null : Number(r.min_value),
        });
      }
    }

    const badges: ModalBadge[] = ((badgesRes.data ?? []) as any[]).map((b) => {
      const req = reqs.get(String(b.id));
      return {
        id: String(b.id),
        name: String(b.name),
        icon: typeof b.icon === 'string' ? b.icon : null,
        sortOrder: Number(b.sort_order ?? 0),
        requirementType: req?.type ?? null,
        minValue: req?.min ?? null,
      };
    });

    const userRows = (userRes.data ?? []) as any[];
    setState({
      badges,
      unlocked: new Set(userRows.map((r) => String(r.badge_id))),
      activeId: userRows.find((r) => r.active)?.badge_id ?? null,
    });
  };

  const openModal = () => {
    setOpen(true);
    void load();
  };

  const setActive = async (badgeId: string) => {
    setError(null);
    const { error: rpcError } = await supabase.rpc('set_active_badge', { p_badge_id: badgeId });
    if (rpcError) {
      setError('Could not update your displayed badge.');
      return;
    }
    clearBadgesCache();
    setRefreshKey((k) => k + 1);
    setState((s) => (s ? { ...s, activeId: badgeId } : s));
  };

  const sections = new Map<string, ModalBadge[]>();
  for (const b of state?.badges ?? []) {
    const label = sectionLabel(b.requirementType);
    sections.set(label, [...(sections.get(label) ?? []), b]);
  }
  const orderedSections = [...sections.entries()]
    .map(([label, items]) => [
      label,
      items.sort((a, b) => (a.minValue ?? 0) - (b.minValue ?? 0) || a.sortOrder - b.sortOrder),
    ] as const)
    .sort(([a], [b]) => (a === 'Special' ? 1 : b === 'Special' ? -1 : a.localeCompare(b)));

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="View all badges"
        className="cursor-pointer rounded-full hover:opacity-80"
      >
        <UserBadgesInline key={refreshKey} userId={userId} maxBadges={3} />
        {!state && <span className="sr-only">Badges</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Badges"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-surface p-6 text-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Badges</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-2xl leading-none">
                ×
              </button>
            </div>
            <p className="mb-4 text-sm opacity-70">Select an unlocked badge to display next to your name.</p>
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
            {loading && !state && <p>Loading…</p>}
            {state &&
              orderedSections.map(([label, items]) => (
                <section key={label} className="mb-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-70">{label}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((b) => {
                      const isUnlocked = state.unlocked.has(b.id);
                      const isActive = state.activeId === b.id;
                      return isUnlocked ? (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setActive(b.id)}
                          aria-pressed={isActive}
                          className={`flex flex-col items-center gap-1 rounded-lg border-2 border-yellow-400 p-3 text-center font-semibold text-yellow-500 ${
                            isActive ? 'bg-yellow-400/20 ring-2 ring-yellow-400' : 'hover:bg-yellow-400/10'
                          }`}
                        >
                          <span aria-hidden className="text-2xl">{b.icon || '🏅'}</span>
                          <span className="text-sm">{b.name}</span>
                          {isActive && <span className="text-[10px] uppercase">Displayed</span>}
                        </button>
                      ) : (
                        <div
                          key={b.id}
                          className="flex flex-col items-center gap-1 rounded-lg border border-gray-400/40 p-3 text-center opacity-60"
                        >
                          <span aria-hidden className="text-2xl">❔</span>
                          <span className="text-sm">???</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
