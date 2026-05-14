import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { createGoogleCalendarWatch } from '@/lib/google-calendar';

export async function POST(request: Request) {
  try {
    await requireAuth();

    const watch = await createGoogleCalendarWatch(request.url);

    return NextResponse.json(
      {
        ok: true,
        watch,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create Google Calendar watch';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}