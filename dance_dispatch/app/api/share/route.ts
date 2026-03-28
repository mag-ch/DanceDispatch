import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

function normalizeEntityType(value: string): 'event' | 'host' | 'venue' | 'user' | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'event' || normalized === 'events') return 'event';
  if (normalized === 'host' || normalized === 'hosts') return 'host';
  if (normalized === 'venue' || normalized === 'venues') return 'venue';
  if (normalized === 'user' || normalized === 'users') return 'user';
  return null;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const payload = await request.json();

    const entity = typeof payload.entity === 'string' ? payload.entity : '';
    const entityId = typeof payload.entityId === 'string' ? payload.entityId.trim() : '';
    const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 280) : '';
    const entityType = normalizeEntityType(entity);
    const recipientUserIds = Array.isArray(payload.recipientUserIds)
      ? Array.from(new Set(payload.recipientUserIds.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)))
      : [];

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'A valid entity and entity id are required.' }, { status: 400 });
    }

    if (recipientUserIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one recipient.' }, { status: 400 });
    }

    const filteredRecipientIds = recipientUserIds.filter((recipientId) => recipientId !== user.id);
    if (filteredRecipientIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one recipient other than yourself.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: recipientProfiles, error: recipientError } = await supabase
      .from('profiles')
      .select('id')
      .in('id', filteredRecipientIds);

    if (recipientError) {
      console.error('Error validating share recipients:', recipientError);
      return NextResponse.json({ error: 'Unable to validate recipients.' }, { status: 500 });
    }

    const validRecipientIds = (recipientProfiles ?? [])
      .map((profile: any) => String(profile.id ?? '').trim())
      .filter(Boolean);

    if (validRecipientIds.length === 0) {
      return NextResponse.json({ error: 'No valid recipients were found.' }, { status: 400 });
    }

    const rows = validRecipientIds.map((recipientUserId) => ({
      sender_id: user.id,
      recipient_id: recipientUserId,
      entity_type: entityType,
      entity_id: entityId,
      message: note || null,
    }));

    const { error: insertError } = await supabase.from('SharedItems').insert(rows);

    if (insertError) {
      console.error('Error creating share notifications:', insertError);
      return NextResponse.json({ error: 'Unable to send share notifications.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (error) {
    console.error('Error in POST /api/share:', error);
    const message = error instanceof Error ? error.message : 'Unable to share right now.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}