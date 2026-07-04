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

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createServerClient();
    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get('limit') ?? '30');
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    let query = supabase
      .from('user_notifications')
      .select('id,type,title,body,href,is_read,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const notifications = (data ?? []).map((row) => {
      const item = row as UserNotificationRow;
      return {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.body,
        createdAt: item.created_at,
        href: item.href,
        isRead: item.is_read,
      };
    });
    
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

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createServerClient();
    const body = (await request.json().catch(() => ({}))) as {
      ids?: string[];
      markAllRead?: boolean;
      isRead?: boolean;
    };

    const isRead = body.isRead ?? true;
    const patch = {
      is_read: isRead,
      read_at: isRead ? new Date().toISOString() : null,
    };

    let updateQuery = supabase
      .from('user_notifications')
      .update(patch)
      .eq('user_id', user.id);

    if (!body.markAllRead) {
      const ids = Array.from(new Set((body.ids ?? []).map((id) => String(id).trim()).filter(Boolean)));
      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: 'No notification ids provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updateQuery = updateQuery.in('id', ids);
    }

    const { error } = await updateQuery;
    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update notifications';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    console.error('Error updating notifications:', error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
