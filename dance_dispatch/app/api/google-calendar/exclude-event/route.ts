import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { deleteEvent } from '@/lib/utils_supabase_server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = (await request.json()) as { googleCalId?: string };
    const googleCalId = String(body?.googleCalId || '').trim();

    if (!googleCalId) {
      return NextResponse.json({ error: 'googleCalId is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Upsert a pending_events row with exclude=true so future syncs skip this event.
    const { error } = await supabase.from('pending_events').upsert(
      {
        google_cal_id: googleCalId,
        exclude: true,
      },
      {
        onConflict: 'google_cal_id',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pendingEventLookup = await supabase
      .from('pending_events')
      .select('event_id')
      .eq('google_cal_id', googleCalId)
      .limit(1);


    if (pendingEventLookup.error) {
      return NextResponse.json({ error: pendingEventLookup.error.message }, { status: 500 });
    }

    const rawEventId = pendingEventLookup.data?.[0]?.event_id;
    const eventId = Number(rawEventId);

    if (!Number.isFinite(eventId) || eventId <= 0) {
      console.warn('Exclude event: no valid event_id found, skipping deleteEvent call', {
        googleCalId,
        rawEventId,
      });
      return NextResponse.json(
        { ok: true, googleCalId, deleted: false, reason: 'no_valid_event_id' },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, googleCalId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to exclude event';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    const body = (await request.json()) as { googleCalId?: string };
    const googleCalId = String(body?.googleCalId || '').trim();

    if (!googleCalId) {
      return NextResponse.json({ error: 'googleCalId is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Remove exclusion by setting exclude=false so next sync can import it.
    const { error } = await supabase
      .from('pending_events')
      .update({ exclude: false })
      .eq('google_cal_id', googleCalId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, googleCalId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove exclusion';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
