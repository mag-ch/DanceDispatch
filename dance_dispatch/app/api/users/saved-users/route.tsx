import { requireAuth } from '@/lib/auth-helpers';
import { getFollowedUsers } from '@/lib/server_utils';


//returns all of current user's saved events
export async function GET(_request: Request) {
    try {
        const user = await requireAuth();
        const followedUsers = await getFollowedUsers(user.id);

        return new Response(JSON.stringify(followedUsers), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching followed users:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch followed users' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}