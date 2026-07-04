import { requireAuth } from '@/lib/auth-helpers';
import { createClient as createServerClient } from '@/lib/supabase/server';

type UserNotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  is_read: boolean;
  created_at: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ notifId: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createServerClient();

    const { notifId } = await params;
    const id = String(notifId ?? '').trim();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing notification ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('user_notifications')
      .select('id,type,title,body,href,is_read,created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const row = data as UserNotificationRow;

    return new Response(JSON.stringify({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.body,
      createdAt: row.created_at,
      href: row.href,
      isRead: row.is_read,
    }), {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notifId: string }> }
) {
  try {
    const user = await requireAuth();
    const supabase = await createServerClient();
    const { notifId } = await params;
    const id = String(notifId ?? '').trim();
    const body = (await request.json().catch(() => ({}))) as { isRead?: boolean };

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing notification ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isRead = body.isRead ?? true;
    const { error } = await supabase
      .from('user_notifications')
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update notification';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    console.error('Error updating notification:', error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
