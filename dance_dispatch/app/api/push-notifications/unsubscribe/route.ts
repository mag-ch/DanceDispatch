import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { deletePushSubscription } from '@/lib/push-notifications';

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';

    if (!endpoint) {
      return NextResponse.json({ error: 'A subscription endpoint is required.' }, { status: 400 });
    }

    await deletePushSubscription(user.id, endpoint);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unsubscribe from push notifications.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}