import { NextRequest, NextResponse } from 'next/server';
import { checkEventSaved, userSaveEvent } from '@/lib/utils';
import { getCurrentUserId, requireAuth } from '@/lib/auth-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const user = await requireAuth();
        const isSaved = await checkEventSaved({ id: eventId } as any, user.id);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved event:', error);
        return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
    }
}


export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
    try {
        const { saveToggle } = await request.json();
        const { eventId } = await params;
        const user = await requireAuth();
       
        await userSaveEvent(eventId, user.id, saveToggle);


        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in POST /saved-events:', error);
        return new Response(JSON.stringify({ error: 'Failed to save event' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}