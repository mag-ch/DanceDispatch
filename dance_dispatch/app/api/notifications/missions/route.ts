import { requireAuth } from '@/lib/auth-helpers';
import { checkNewUserMissions } from '@/lib/utils_supabase_server';

export async function GET() {
  try {
    const user = await requireAuth();
    const status = await checkNewUserMissions(user.id);
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch mission status';
    const statusCode = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
