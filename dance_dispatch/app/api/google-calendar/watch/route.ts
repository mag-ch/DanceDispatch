import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { createGoogleCalendarWatch } from '@/lib/google-calendar';
import { addGoogleCalendarWebhookLog } from '@/lib/google-calendar-webhook-log';

export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = (await request.json().catch(() => null)) as
      | {
          previousChannel?: {
            id?: string;
            resourceId?: string;
          };
        }
      | null;

    const watch = await createGoogleCalendarWatch(request.url, body?.previousChannel || null);

    await addGoogleCalendarWebhookLog('watch_registered', {
      channelId: watch.id,
      resourceId: watch.resourceId,
      expiration: watch.expiration,
    });

    return NextResponse.json(
      {
        ok: true,
        watch,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create Google Calendar watch';
    await addGoogleCalendarWebhookLog('watch_registration_error', { message }, 'error');
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}