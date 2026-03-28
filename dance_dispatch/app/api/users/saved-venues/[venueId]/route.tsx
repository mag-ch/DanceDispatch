import { NextRequest, NextResponse } from 'next/server';
import { checkVenueSaved, userSaveVenue } from '@/lib/utils_supabase_server';
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


export async function POST(request: Request, { params }: { params: Promise<{ venueId: string }> }) {
    try {
        const { saveToggle } = await request.json();
        if (typeof saveToggle !== 'boolean') {
            return NextResponse.json({ error: 'saveToggle must be a boolean' }, { status: 400 });
        }

        const { venueId } = await params;
        const numericVenueId = Number(venueId);
        if (Number.isNaN(numericVenueId)) {
            return NextResponse.json({ error: 'Invalid venue id' }, { status: 400 });
        }

        const user = await requireAuth();
      
        await userSaveVenue(String(numericVenueId), user.id, saveToggle);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in POST /saved-venues:', error);
        return NextResponse.json({ error: 'Failed to save venue' }, { status: 500 });
    }
}
