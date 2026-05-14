import { NextResponse } from 'next/server';

import { isValidGoogleChannelToken, syncGoogleCalendarEventsToSupabase } from '@/lib/google-calendar';
import { addGoogleCalendarWebhookLog } from '@/lib/google-calendar-webhook-log';

export async function POST(request: Request) {
  try {
    if (!isValidGoogleChannelToken(request.headers)) {
      addGoogleCalendarWebhookLog('webhook_invalid_channel_token', {
        channelId: request.headers.get('x-goog-channel-id'),
        resourceId: request.headers.get('x-goog-resource-id'),
      }, 'warn');
      return new NextResponse(null, { status: 401 });
    }

    const resourceState = request.headers.get('x-goog-resource-state') ?? '';
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceId = request.headers.get('x-goog-resource-id');
    const messageNumber = request.headers.get('x-goog-message-number');

    console.log('Google Calendar webhook notification received', {
      resourceState,
      channelId,
      resourceId,
      messageNumber,
    });

    addGoogleCalendarWebhookLog('webhook_received', {
      resourceState,
      channelId,
      resourceId,
      messageNumber,
    });

    if (resourceState === 'sync') {
      addGoogleCalendarWebhookLog('webhook_sync_handshake', {
        channelId,
        resourceId,
      });
      return new NextResponse(null, { status: 204 });
    }

    const summary = await syncGoogleCalendarEventsToSupabase();
    addGoogleCalendarWebhookLog('webhook_sync_complete', {
      channelId,
      resourceId,
      messageNumber,
      summary,
    });
    return NextResponse.json({ ok: true, summary }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    addGoogleCalendarWebhookLog('webhook_error', { message }, 'error');
    console.error('Error handling POST /google-calendar/events:', error);
    return NextResponse.json({ error: 'Failed to handle Google Calendar webhook' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, path: '/google-calendar/events' });
}