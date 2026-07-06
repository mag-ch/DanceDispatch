import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { PUSH_TEST_USER_ID } from '@/lib/push-notification-constants';
import { sendPushToUser } from '@/lib/push-notifications';

export async function POST() {
  try {
    const user = await requireAuth();

    if (user.id !== PUSH_TEST_USER_ID) {
      return NextResponse.json({ error: 'Only the configured test user can send this notification.' }, { status: 403 });
    }

    const result = await sendPushToUser(PUSH_TEST_USER_ID, {
      title: 'DanceDispatch push test',
      body: 'Your web push stack is live.',
      href: '/?announcement=1',
      tag: 'dance-dispatch-test',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send test notification.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}