import { getHostMedia } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { NextResponse } from 'next/server';

const APPROVED_USER_IDS = [
    'ba398812-06a0-4c48-9f15-0660d3af0047',
    'f2694e1c-5457-45b0-b299-c3a03a77d8c5',
];

const canEditDetails = (userId?: string | null) => Boolean(userId && APPROVED_USER_IDS.includes(userId));

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const { hostId } = await params;
        const media = await getHostMedia(hostId);
        
        if (!media) {
            return new Response(JSON.stringify({ error: `Media for ${hostId} not found` }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(media), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch media' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        await requireAuth();
        const { hostId } = await params;
        const body = await request.json();

        const type = typeof body?.type === 'string' ? body.type.trim().toLowerCase() : '';
        const link = typeof body?.link === 'string' ? body.link.trim() : '';
        const embedCode = typeof body?.embed_code === 'string' ? body.embed_code.trim() : '';

        if (!type) {
            return NextResponse.json({ error: 'Media type is required' }, { status: 400 });
        }

        if (!link && !embedCode) {
            return NextResponse.json({ error: 'Either link or embed_code is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const payload = {
            host_id: Number(hostId),
            type,
            link: link || null,
            embed_code: embedCode || null,
        };

        const { data, error } = await supabase
            .from('host_media')
            .insert(payload)
            .select('id,host_id,type,link,embed_code')
            .single();

        if (error) {
            console.error('Error inserting host media:', error);
            return NextResponse.json({ error: 'Failed to create host media' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create host media';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const user = await requireAuth();
        if (!canEditDetails(user.id)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { hostId } = await params;
        const parsedHostId = Number(hostId);
        if (Number.isNaN(parsedHostId)) {
            return NextResponse.json({ error: 'Invalid host id' }, { status: 400 });
        }

        const url = new URL(request.url);
        const mediaIdRaw = url.searchParams.get('mediaId') ?? '';
        const mediaId = Number(mediaIdRaw);
        if (!mediaIdRaw || Number.isNaN(mediaId)) {
            return NextResponse.json({ error: 'Invalid media id' }, { status: 400 });
        }

        const supabase = await createClient();
        const { error } = await supabase
            .from('host_media')
            .delete()
            .eq('id', mediaId)
            .eq('host_id', parsedHostId);

        if (error) {
            console.error('Error deleting host media:', error);
            return NextResponse.json({ error: 'Failed to delete host media' }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete host media';
        const lowered = message.toLowerCase();
        const status = lowered.includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
