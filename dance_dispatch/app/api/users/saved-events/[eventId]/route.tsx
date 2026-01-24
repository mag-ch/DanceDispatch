import { NextRequest, NextResponse } from 'next/server';
import { checkEventSaved } from '@/lib/utils';
import { getCurrentUserId } from '@/lib/auth-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const userId = await getCurrentUserId();
        const isSaved = await checkEventSaved({ id: eventId } as any, userId);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved event:', error);
        return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
    }
}
