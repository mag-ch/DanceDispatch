import { NextResponse } from 'next/server';

import { isValidGoogleChannelToken, syncGoogleCalendarEventsToSupabase } from '@/lib/google-calendar';
import { addGoogleCalendarWebhookLog } from '@/lib/google-calendar-webhook-log';

function parseWebhookEventType(resourceState: string): string {
  switch (resourceState) {
    case 'sync':
      return 'sync';
    case 'exists':
      return 'changed';
    case 'not_exists':
      return 'deleted';
    default:
      return resourceState || 'unknown';
  }
}

function parseWebhookTriggerDate(headers: Headers): string {
  const headerDate = headers.get('date');
  if (headerDate) {
    const parsed = new Date(headerDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

export async function POST(request: Request) {
  try {
    const requestHeaders = Object.fromEntries(request.headers.entries());
    const bodyText = await request.text();
    const resourceState = request.headers.get('x-goog-resource-state') ?? '';
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceId = request.headers.get('x-goog-resource-id');
    const messageNumber = request.headers.get('x-goog-message-number');
    const eventType = parseWebhookEventType(resourceState);
    const triggerDate = parseWebhookTriggerDate(request.headers);

    console.log('Google Calendar webhook request', {
      eventType,
      triggerDate,
      resourceState,
      channelId,
      resourceId,
      messageNumber,
      headers: requestHeaders,
      body: bodyText || null,
    });

    if (!isValidGoogleChannelToken(request.headers)) {
      await addGoogleCalendarWebhookLog('webhook_invalid_channel_token', {
        eventType,
        triggerDate,
        channelId: request.headers.get('x-goog-channel-id'),
        resourceId: request.headers.get('x-goog-resource-id'),
      }, 'warn');
      return new NextResponse(null, { status: 401 });
    }

    console.log('Google Calendar webhook notification received', {
      eventType,
      triggerDate,
      resourceState,
      channelId,
      resourceId,
      messageNumber,
    });

    await addGoogleCalendarWebhookLog('webhook_received', {
      eventType,
      triggerDate,
      resourceState,
      channelId,
      resourceId,
      messageNumber,
    });

    if (resourceState === 'sync') {
      await addGoogleCalendarWebhookLog('webhook_sync_handshake', {
        eventType,
        triggerDate,
        channelId,
        resourceId,
      });
      return new NextResponse(null, { status: 204 });
    }

    const summary = await syncGoogleCalendarEventsToSupabase();
    console.log('Google Calendar webhook changed events', {
      eventType,
      triggerDate,
      syncMode: summary.syncMode,
      changedEvents: summary.changedEvents,
    });

    await addGoogleCalendarWebhookLog('webhook_sync_complete', {
      eventType,
      triggerDate,
      channelId,
      resourceId,
      messageNumber,
      summary,
      changedEvents: summary.changedEvents,
    });
    return NextResponse.json({ ok: true, summary }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    await addGoogleCalendarWebhookLog('webhook_error', { message }, 'error');
    console.error('Error handling POST /google-calendar/events:', error);
    return NextResponse.json({ error: 'Failed to handle Google Calendar webhook' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, path: '/google-calendar/events' });
}