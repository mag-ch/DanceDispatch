import { userSaveEvent } from '@/lib/utils';
import { requireAuth } from '@/lib/auth-helpers';

export async function POST(request: Request) {
    try {
        const { entId, saveToggle } = await request.json();
        const user = await requireAuth();
        await userSaveEvent(entId, user.id, saveToggle);
        //  await (eventId, user.id, saveToggle );

        // const { error } = await supabase
        //     .from('saved_events')
        //     .upsert({
        //         id: `${user.id}-${eventId}`,
        //         user_id: user.id,
        //         event_id: eventId,
        //         saved: true
        //     }).select();

        // if (error) {
        //     console.error('Error saving event:', error);
        //     return new Response(JSON.stringify({ error: 'Failed to save event' }), {
        //         status: 500,
        //         headers: { 'Content-Type': 'application/json' },
        //     });
        // }

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