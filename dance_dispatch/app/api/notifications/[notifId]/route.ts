import { requireAuth } from '@/lib/auth-helpers';
import { getPatchNoteFromId } from '@/lib/utils_supabase_server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ notifId: string }> }
) {
  try {
    await requireAuth();

    const { notifId } = await params;
    const id = String(notifId ?? '').trim();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing notification ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const patchNote = await getPatchNoteFromId(id);
    if (!patchNote) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id, ...patchNote }), {
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
