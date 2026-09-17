import { getVenues } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        const { venueId } = await params;
        const venues = await getVenues();
        const venue = venues.find(v => v.id === venueId);        
        if (!venue) {
            return new Response(JSON.stringify({ error: 'Venue not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(venue), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch venue' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        await requireAdmin();
        const { venueId } = await params;
        const body = await request.json();
        const { name, bio, address, type, photoUrl, website } = body;

        const updates: Record<string, unknown> = {};
        if (typeof name === 'string') updates.name = name.trim();
        if (typeof bio === 'string') updates.bio = bio.trim();
        if (typeof address === 'string') updates.address = address.trim();
        if (typeof type === 'string') updates.type = type.trim();
        if (typeof website === 'string') updates.external_url = website.trim();
        if (typeof photoUrl === 'string') updates.image_url = photoUrl.trim();

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = await createClient();
        const { error } = await supabase.from('Venues').update(updates).eq('id', venueId);
        if (error) {
            console.error('Error updating venue:', error);
            return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update venue';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}