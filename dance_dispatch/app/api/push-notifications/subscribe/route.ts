import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { savePushSubscription } from '@/lib/push-notifications';

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const subscription = body?.subscription as PushSubscriptionJSON | undefined;

    if (!subscription) {
      return NextResponse.json({ error: 'A push subscription is required.' }, { status: 400 });
    }

    await savePushSubscription(user.id, subscription, request.headers.get('user-agent') ?? undefined);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to subscribe to push notifications.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}