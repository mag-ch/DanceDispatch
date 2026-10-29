import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type PendingEventRow = {
  event_id: number | string | null;
  google_cal_id?: string | null;
  created_by?: string | null;
  exclude?: boolean | null;
  Events?: EventRow | EventRow[] | null;
};

type EventRow = { id: number | string; title?: string | null; start?: string | null };

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error('Missing Supabase env vars');
  }

  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    await requireAuth();

    const supabase = getSupabaseClient();
    const pendingResult = await supabase
      .from('pending_events')
      // Events!event_id!inner joins through the event_id foreign key (the column name disambiguates
      // the relationship) and inner-joins, so rows with no matching Events.id are dropped by the query.
      .select('event_id,google_cal_id,created_by,exclude,Events!event_id!inner(id,title,start)')
      .eq('exclude', false)
      .limit(200);

    if (pendingResult.error) {
      return NextResponse.json({ error: pendingResult.error.message }, { status: 500 });
    }

    const pendingRows = (pendingResult.data || []) as unknown as PendingEventRow[];

    const items = pendingRows
      .map((row) => {
        const eventId = String(row.event_id ?? '').trim();
        const event = Array.isArray(row.Events) ? row.Events[0] : row.Events;
        if (!eventId || !event) {
          return null;
        }

        return {
          eventId,
          title: String(event.title ?? 'Untitled event').trim() || 'Untitled event',
          start: String(event.start ?? '').trim() || null,
          googleCalId: String(row.google_cal_id ?? '').trim() || null,
          createdBy: String(row.created_by ?? '').trim() || null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => {
        const leftTime = left.start ? Date.parse(left.start) : 0;
        const rightTime = right.start ? Date.parse(right.start) : 0;
        return rightTime - leftTime;
      });

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load pending events';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}