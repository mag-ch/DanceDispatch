import { requireAuth } from '@/lib/auth-helpers';
import { getUserNotifications } from '@/lib/utils_supabase_server';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit') ?? '30');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;

    const notifications = await getUserNotifications(user.id, limit);
    
    return new Response(JSON.stringify(notifications), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notifications';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    console.error('Error fetching notifications:', error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
