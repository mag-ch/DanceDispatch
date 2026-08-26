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

    const body = (await request.json()) as { eventId?: string };
    const eventId = String(body?.eventId || '').trim();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Upsert a pending_events row with exclude=true so future syncs skip this event.
    const { error } = await supabase.from('pending_events').upsert(
      {
        event_id: eventId,
        exclude: true,
      },
      {
        onConflict: 'event_id',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    

    return NextResponse.json({ ok: true, eventId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to exclude event';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    const body = (await request.json()) as { eventId?: string };
    const eventId = String(body?.eventId || '').trim();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Remove exclusion by setting exclude=false so next sync can import it.
    const { error } = await supabase
      .from('pending_events')
      .update({ exclude: false })
      .eq('event_id', eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, eventId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove exclusion';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
