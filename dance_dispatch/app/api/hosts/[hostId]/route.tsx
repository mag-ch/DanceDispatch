import { getHostById } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const { hostId } = await params;
        const host = await getHostById(hostId);
        if (!host) {
            return new Response(JSON.stringify({ error: 'Host not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(host), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch host' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

    export async function PATCH(
        request: Request,
        { params }: { params: Promise<{ hostId: string }> }
    ) {
        try {
            await requireAuth();
            const { hostId } = await params;
            const body = await request.json();
                const { name, bio, tags, genre, photoUrl } = body;

            const updates: Record<string, unknown> = {};
            if (typeof name === 'string') updates.name = name.trim();
            if (typeof bio === 'string') updates.bio = bio.trim();
            if (Array.isArray(tags)) updates.tags = tags;
            if (Array.isArray(genre)) updates.genre = genre;
            if (typeof photoUrl === 'string') updates.image_url = photoUrl.trim();

            if (Object.keys(updates).length === 0) {
                return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
            }

            const supabase = await createClient();
            const { error } = await supabase.from('Hosts').update(updates).eq('id', hostId);
            if (error) {
                console.error('Error updating host:', error);
                return NextResponse.json({ error: 'Failed to update host' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        } catch (error: any) {
            if (error?.status === 401) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            console.error('Error in PATCH /api/hosts/[hostId]:', error);
            return NextResponse.json({ error: 'Failed to update host' }, { status: 500 });
        }
    }