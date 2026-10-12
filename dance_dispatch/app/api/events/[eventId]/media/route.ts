import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth-helpers';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const user = await requireAuth();
        const { eventId } = await params;
        const numericEventId = Number(eventId);
        const body = await request.json().catch(() => null);
        const path = typeof body?.path === 'string' ? body.path : '';
        const expectedPrefix = `events/${eventId}/${user.id}/`;

        if (!Number.isInteger(numericEventId) || numericEventId <= 0) {
            return NextResponse.json({ error: 'Invalid event id.' }, { status: 400 });
        }
        if (!path.startsWith(expectedPrefix) || path.slice(expectedPrefix.length).includes('/')) {
            return NextResponse.json({ error: 'You can only delete your own event media.' }, { status: 403 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing Supabase service configuration.');
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: reviewMediaError } = await supabase
            .from('ReviewMedia')
            .delete()
            .eq('storage_path', path);
        if (reviewMediaError) throw reviewMediaError;

        const { error: storageError } = await supabase.storage.from('event-media').remove([path]);
        if (storageError) throw storageError;

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete event media.';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}