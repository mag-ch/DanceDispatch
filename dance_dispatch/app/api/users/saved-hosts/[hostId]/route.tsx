import { NextRequest, NextResponse } from 'next/server';
import { checkHostSaved } from '@/lib/utils';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const { hostId } = await params;
        const isSaved = await checkHostSaved({ id: hostId } as any);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved event:', error);
        return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
    }
}
