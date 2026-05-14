import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { getGoogleCalendarWebhookLogs } from '@/lib/google-calendar-webhook-log';

export async function GET() {
  try {
    await requireAuth();
    const logs = await getGoogleCalendarWebhookLogs();
    return NextResponse.json({ ok: true, logs }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load webhook logs';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
