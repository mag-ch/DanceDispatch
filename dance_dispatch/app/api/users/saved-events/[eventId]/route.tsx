// import { checkEventSaved, userSaveEvent } from '@/lib/utils';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const user = await requireAuth();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('SavedEvents')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_id', eventId)
            .maybeSingle();

        if (error) {
            console.error('Error checking saved event:', error);
            return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
        }

        return NextResponse.json({ isSaved: !!data });
    } catch (error) {
        console.error('Error checking saved event:', error);
        return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
    try {
        const { saveToggle } = await request.json();
        if (typeof saveToggle !== 'boolean') {
            return NextResponse.json({ error: 'saveToggle must be a boolean' }, { status: 400 });
        }

        const { eventId } = await params;
        const user = await requireAuth();
        const supabase = await createClient();
        // query event id from Events table to ensure it exists
        const { data: eventData, error: eventError } = await supabase
            .from('Events')
            .select('id')
            .eq('id', eventId)
            .maybeSingle();
        if (!eventData) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }
        if (saveToggle) {
            const { error } = await supabase
                .from('SavedEvents')
                .insert({ event_id: eventData.id, user_id: user.id });
            if (error) {
                console.error('Error saving event:', error);
                return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
            }
        } else {
            const { error } = await supabase
                .from('SavedEvents')
                .delete()
                .eq('user_id', user.id)
                .eq('event_id', eventData.id);
            if (error) {
                console.error('Error unsaving event:', error);
                return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in POST /saved-events:', error);
        return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
    }
}

// export async function GET(
//     request: NextRequest,
//     { params }: { params: Promise<{ eventId: string }> }
// ) {
//     try {
//         const { eventId } = await params;
//         const user = await requireAuth();
//         const isSaved = await checkEventSaved({ id: eventId } as any, user.id);
//         return NextResponse.json({ isSaved });
//     } catch (error) {
//         console.error('Error checking saved event:', error);
//         return NextResponse.json({ error: 'Failed to check saved event' }, { status: 500 });
//     }
// }



// export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
//     try {
//         const { saveToggle } = await request.json();
//         const { eventId } = await params;
//         const user = await requireAuth();
       
//         await userSaveEvent(eventId, user.id, saveToggle);


//         return new Response(JSON.stringify({ success: true }), {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     } catch (error) {
//         console.error('Error in POST /saved-events:', error);
//         return new Response(JSON.stringify({ error: 'Failed to save event' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' },
//         });
//     }
// }