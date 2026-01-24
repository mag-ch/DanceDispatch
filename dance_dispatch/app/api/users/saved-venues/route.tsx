import { userSaveVenue } from '@/lib/utils';
import { requireAuth } from '@/lib/auth-helpers';

export async function POST(request: Request) {
    try {
        const { entId, saveToggle } = await request.json();
        const user = await requireAuth();
        await userSaveVenue(entId, user.id, saveToggle);
     
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in POST /saved-venues:', error);
        return new Response(JSON.stringify({ error: 'Failed to save venue' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}