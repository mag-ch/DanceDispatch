import { requireAuth } from '@/lib/auth-helpers';
import { getSavedEventsForUserServer } from '@/lib/server_utils';


//returns all of current user's saved events
export async function GET(_request: Request) {
    try {
        const user = await requireAuth();
        const savedEvents = await getSavedEventsForUserServer(user.id);

        return new Response(JSON.stringify(savedEvents), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching saved events:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch saved events' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}