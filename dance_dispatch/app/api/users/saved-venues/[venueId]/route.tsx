import { NextRequest, NextResponse } from 'next/server';
import { checkVenueSaved } from '@/lib/utils';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        const { venueId } = await params;
        const isSaved = await checkVenueSaved({ id: venueId } as any);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved event:', error);
        return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
    }
}
