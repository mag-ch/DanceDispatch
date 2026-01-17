import { createClient } from '@/lib/supabase/server';
import { userSaveEvent } from '@/lib/utils';

const supabase = createClient();

export async function POST(request: Request) {
    try {
        const { eventId, saveToggle } = await request.json();
        console.log('Supabase client:', supabase);  
        const { data: { user }, error } = await supabase.auth.getUser();
        console.log('Authenticated user:', user, 'Error:', error);
        if (error || !user) {
            return new Response(JSON.stringify({ error: 'User not authenticated ' + error }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        await userSaveEvent(eventId, user.id, saveToggle);
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