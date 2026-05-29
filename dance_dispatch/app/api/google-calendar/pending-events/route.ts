import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type PendingEventRow = {
  event_id: number | string | null;
  google_cal_id?: string | null;
  created_by?: string | null;
  exclude?: boolean | null;
};

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
      .select('event_id,google_cal_id,created_by,exclude')
      .eq('exclude', false)
      .not('event_id', 'is', null)
      .limit(200);

    if (pendingResult.error) {
      return NextResponse.json({ error: pendingResult.error.message }, { status: 500 });
    }

    const pendingRows = (pendingResult.data || []) as PendingEventRow[];
    const eventIds = Array.from(
      new Set(
        pendingRows
          .map((row) => Number(row.event_id))
          .filter((eventId) => Number.isFinite(eventId) && eventId > 0)
      )
    );

    if (eventIds.length === 0) {
      return NextResponse.json({ ok: true, items: [] }, { status: 200 });
    }

    const eventsResult = await supabase.from('Events').select('id,title,start').in('id', eventIds);
    if (eventsResult.error) {
      return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });
    }

    const eventsById = new Map(
      (eventsResult.data || []).map((row: { id: number | string; title?: string | null; start?: string | null }) => [
        String(row.id),
        row,
      ])
    );

    const items = pendingRows
      .map((row) => {
        const eventId = String(row.event_id ?? '').trim();
        const event = eventsById.get(eventId);
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