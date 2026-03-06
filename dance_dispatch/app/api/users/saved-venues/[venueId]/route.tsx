import { NextRequest, NextResponse } from 'next/server';
import { checkVenueSaved } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        const user = await requireAuth();
        const { venueId } = await params;
        const isSaved = await checkVenueSaved(venueId, user.id);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved event:', error);
        return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
    }
}
