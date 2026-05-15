import 'server-only';

import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

type GoogleOAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type GoogleWatchResponse = {
  kind?: string;
  id?: string;
  resourceId?: string;
  resourceUri?: string;
  expiration?: string;
};

type GoogleChannelReference = {
  id: string;
  resourceId: string;
};

let lastCreatedChannel: GoogleChannelReference | null = null;

type GoogleCalendarEventDate = {
  date?: string;
  dateTime?: string;
};

type GoogleCalendarEventItem = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  recurringEventId?: string;
  recurrence?: string[];
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
};

type GoogleCalendarEventsListResponse = {
  items?: GoogleCalendarEventItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type GoogleCalendarFetchedEvents = {
  items: GoogleCalendarEventItem[];
  nextSyncToken: string | null;
  syncMode: 'full' | 'incremental';
};

export type GoogleCalendarChangedEvent = {
  googleCalId: string;
  title: string;
  start: string | null;
  status: string;
};

export type GoogleCalendarSyncSummary = {
  fetched: number;
  inserted: number;
  skippedExisting: number;
  skippedInvalid: number;
  skippedRecurring: number;
  skippedExcluded: number;
  pendingQueued: number;
  syncMode: 'full' | 'incremental';
  changedEvents: GoogleCalendarChangedEvent[];
};

const GOOGLE_CALENDAR_SYNC_TOKEN_PATH = path.join(process.cwd(), 'instance', 'google-calendar-sync-token.txt');
const GOOGLE_CALENDAR_WEBHOOK_PATH = '/google-calendar/events';

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readGoogleCalendarSyncToken(): Promise<string | null> {
  try {
    const token = await readFile(GOOGLE_CALENDAR_SYNC_TOKEN_PATH, 'utf8');
    const trimmed = token.trim();
    return trimmed || null;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeGoogleCalendarSyncToken(token: string): Promise<void> {
  await mkdir(path.dirname(GOOGLE_CALENDAR_SYNC_TOKEN_PATH), { recursive: true });
  await writeFile(GOOGLE_CALENDAR_SYNC_TOKEN_PATH, token, 'utf8');
}

async function clearGoogleCalendarSyncToken(): Promise<void> {
  try {
    await unlink(GOOGLE_CALENDAR_SYNC_TOKEN_PATH);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

export function getGoogleCalendarWebhookUrl(requestUrl?: string): string {
  const configured = process.env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
  if (configured) {
    const configuredUrl = new URL(configured);
    if (configuredUrl.protocol !== 'https:') {
      throw new Error('GOOGLE_CALENDAR_WEBHOOK_URL must use https://');
    }
    if (configuredUrl.pathname !== GOOGLE_CALENDAR_WEBHOOK_PATH) {
      throw new Error(
        `GOOGLE_CALENDAR_WEBHOOK_URL must point to ${GOOGLE_CALENDAR_WEBHOOK_PATH}, received ${configuredUrl.pathname}`
      );
    }
    return configuredUrl.toString();
  }

  if (!requestUrl) {
    throw new Error('Missing GOOGLE_CALENDAR_WEBHOOK_URL and request URL fallback');
  }

  const url = new URL(requestUrl);
  if (url.protocol !== 'https:') {
    throw new Error(
      'Google Calendar webhooks require HTTPS. Set GOOGLE_CALENDAR_WEBHOOK_URL to your public https://.../google-calendar/events endpoint.'
    );
  }
  return `${url.origin}${GOOGLE_CALENDAR_WEBHOOK_PATH}`;
}

export async function getGoogleCalendarAccessToken(): Promise<string> {
  const clientId = getRequiredEnv('GOOGLE_CALENDAR_CLIENT_ID');
  const clientSecret = getRequiredEnv('GOOGLE_CALENDAR_CLIENT_SECRET');
  const refreshToken = getRequiredEnv('GOOGLE_CALENDAR_REFRESH_TOKEN');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json()) as Partial<GoogleOAuthTokenResponse> & { error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || 'Failed to exchange Google refresh token');
  }

  return payload.access_token;
}

async function stopGoogleCalendarChannel(accessToken: string, channel: GoogleChannelReference): Promise<void> {
  const response = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channel.id,
      resourceId: channel.resourceId,
    }),
    cache: 'no-store',
  });

  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  const message = (payload.error?.message || '').toLowerCase();
  const ignorable = response.status === 404 || response.status === 410 || message.includes('not found');
  if (ignorable) {
    return;
  }

  throw new Error(payload.error?.message || 'Failed to stop previous Google Calendar watch channel');
}

function normalizeChannelRef(input?: Partial<GoogleChannelReference> | null): GoogleChannelReference | null {
  const id = String(input?.id || '').trim();
  const resourceId = String(input?.resourceId || '').trim();
  if (!id || !resourceId) {
    return null;
  }

  return { id, resourceId };
}

export async function createGoogleCalendarWatch(
  requestUrl?: string,
  previousChannel?: Partial<GoogleChannelReference> | null
): Promise<GoogleWatchResponse> {
  const accessToken = await getGoogleCalendarAccessToken();
  const calendarId = getRequiredEnv('GOOGLE_CALENDAR_ID');
  const webhookUrl = getGoogleCalendarWebhookUrl(requestUrl);
  const channelToken = process.env.GOOGLE_CALENDAR_CHANNEL_TOKEN?.trim();
  const channelId = process.env.GOOGLE_CALENDAR_CHANNEL_ID?.trim() || crypto.randomUUID();
  const ttl = process.env.GOOGLE_CALENDAR_CHANNEL_TTL?.trim() || '604800';

  const channelToStop = normalizeChannelRef(previousChannel) || lastCreatedChannel;
  if (channelToStop && channelToStop.id !== channelId) {
    await stopGoogleCalendarChannel(accessToken, channelToStop);
  }

  const body: Record<string, unknown> = {
    id: channelId,
    type: 'web_hook',
    address: webhookUrl,
    params: { ttl },
  };

  if (channelToken) {
    body.token = channelToken;
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  );

  const payload = (await response.json()) as GoogleWatchResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Failed to create Google Calendar watch');
  }

  const createdRef = normalizeChannelRef({ id: payload.id, resourceId: payload.resourceId });
  if (createdRef) {
    lastCreatedChannel = createdRef;
  }

  return payload;
}

export function isValidGoogleChannelToken(headers: Headers): boolean {
  const expectedToken = process.env.GOOGLE_CALENDAR_CHANNEL_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }

  return headers.get('x-goog-channel-token') === expectedToken;
}

function getSupabaseServerClient(): SupabaseClient {
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!key) {
    throw new Error('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseHostNamesFromTitle(title: string): string[] {
  const match = title.match(/\((.*?)\)/);
  const hostSection = (match?.[1] || '').trim();
  if (!hostSection || !hostSection.includes('/')) {
    return [];
  }

  return hostSection
    .split('/')
    .map((name) => name.trim())
    .filter(Boolean);
}

function toIsoDateTime(input?: string): string | null {
  if (!input) {
    return null;
  }

  if (input.includes('T')) {
    return input.replace('Z', '+00:00');
  }

  return `${input}T00:00:00+00:00`;
}

function splitLocation(rawLocation?: string): { venueName: string | null; venueAddress: string | null } {
  if (!rawLocation) {
    return { venueName: null, venueAddress: null };
  }

  if (rawLocation.includes(', ')) {
    const [venueName, venueAddress] = rawLocation.split(', ', 2);
    return {
      venueName: venueName || null,
      venueAddress: venueAddress || null,
    };
  }

  return { venueName: null, venueAddress: rawLocation };
}

function isRecurringEvent(item: GoogleCalendarEventItem): boolean {
  return Boolean(item.recurringEventId) || Boolean(item.recurrence?.length);
}

async function getOrCreateVenueId(
  supabase: SupabaseClient,
  venueName: string | null,
  venueAddress: string | null
): Promise<string | null> {
  if (!venueName && !venueAddress) {
    return null;
  }

  if (venueName) {
    const byName = await supabase.from('Venues').select('id').eq('name', venueName).limit(1).maybeSingle();
    if (!byName.error && byName.data?.id) {
      return String(byName.data.id);
    }
  }

  if (venueAddress) {
    const byAddress = await supabase.from('Venues').select('id').eq('address', venueAddress).limit(1).maybeSingle();
    if (!byAddress.error && byAddress.data?.id) {
      return String(byAddress.data.id);
    }
  }

  const insertRes = await supabase
    .from('Venues')
    .insert({
      name: venueName || 'Unknown venue',
      address: venueAddress,
      temp_id: null,
    })
    .select('id')
    .single();

  if (insertRes.error || !insertRes.data?.id) {
    throw new Error(insertRes.error?.message || 'Failed to create venue');
  }

  return String(insertRes.data.id);
}

async function getOrCreateHostIds(supabase: SupabaseClient, hostNames: string[]): Promise<string[]> {
  const hostIds: string[] = [];

  for (const hostName of hostNames) {
    const existing = await supabase.from('Hosts').select('id').eq('name', hostName).limit(1).maybeSingle();
    if (!existing.error && existing.data?.id) {
      hostIds.push(String(existing.data.id));
      continue;
    }

    const created = await supabase
      .from('Hosts')
      .insert({
        name: hostName,
        bio: null,
        tags: null,
      })
      .select('id')
      .single();

    if (!created.error && created.data?.id) {
      hostIds.push(String(created.data.id));
    }
  }

  return hostIds;
}

async function fetchGoogleCalendarEventsForSync(): Promise<GoogleCalendarFetchedEvents> {
  const accessToken = await getGoogleCalendarAccessToken();
  const calendarId = getRequiredEnv('GOOGLE_CALENDAR_ID');
  const existingSyncToken = await readGoogleCalendarSyncToken();

  const allItems: GoogleCalendarEventItem[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  let syncMode: 'full' | 'incremental' = existingSyncToken ? 'incremental' : 'full';

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      maxResults: '2500',
    });

    if (existingSyncToken) {
      params.set('syncToken', existingSyncToken);
    } else {
      params.set('orderBy', 'startTime');
      params.set('timeMin', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    }

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    const payload = (await response.json()) as GoogleCalendarEventsListResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      if (response.status === 410 && existingSyncToken) {
        await clearGoogleCalendarSyncToken();
        return fetchGoogleCalendarEventsForSync();
      }
      throw new Error(payload.error?.message || 'Failed to fetch Google Calendar events');
    }

    allItems.push(...(payload.items || []));
    pageToken = payload.nextPageToken;
    if (payload.nextSyncToken) {
      nextSyncToken = payload.nextSyncToken;
    }
  } while (pageToken);

  if (nextSyncToken) {
    await writeGoogleCalendarSyncToken(nextSyncToken);
  }

  if (!existingSyncToken) {
    syncMode = 'full';
  }

  return {
    items: allItems,
    nextSyncToken,
    syncMode,
  };
}

export async function syncGoogleCalendarEventsToSupabase(): Promise<GoogleCalendarSyncSummary> {
  const supabase = getSupabaseServerClient();
  const fetched = await fetchGoogleCalendarEventsForSync();
  const events = fetched.items;

  const summary: GoogleCalendarSyncSummary = {
    fetched: events.length,
    inserted: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    skippedRecurring: 0,
    skippedExcluded: 0,
    pendingQueued: 0,
    syncMode: fetched.syncMode,
    changedEvents: events
      .filter((item) => !isRecurringEvent(item))
      .map((item) => ({
        googleCalId: String(item.id || '').trim(),
        title: (item.summary || 'Untitled event').trim(),
        start: toIsoDateTime(item.start?.dateTime || item.start?.date),
        status: item.status || 'confirmed',
      })),
  };

  for (const item of events) {
    const googleCalId = String(item.id || '').trim();
    const title = (item.summary || 'Untitled event').trim();
    const start = toIsoDateTime(item.start?.dateTime || item.start?.date);
    const end = toIsoDateTime(item.end?.dateTime || item.end?.date);

    if (isRecurringEvent(item)) {
      summary.skippedRecurring += 1;
      continue;
    }

    if (!googleCalId || !start || !end || item.status === 'cancelled') {
      summary.skippedInvalid += 1;
      continue;
    }

    const excluded = await supabase
      .from('pending_events')
      .select('google_cal_id')
      .eq('google_cal_id', googleCalId)
      .eq('exclude', true)
      .limit(1)
      .maybeSingle();

    if (excluded.data?.google_cal_id) {
      summary.skippedExcluded += 1;
      continue;
    }

    const existingEvent = await supabase
      .from('Events')
      .select('id')
      .eq('google_cal_id', googleCalId)
      .limit(1)
      .maybeSingle();

    const existingPending = await supabase
      .from('pending_events')
      .select('google_cal_id')
      .eq('google_cal_id', googleCalId)
      .limit(1)
      .maybeSingle();

    if (existingEvent.data?.id || existingPending.data?.google_cal_id) {
      summary.skippedExisting += 1;
      continue;
    }

    const { venueName, venueAddress } = splitLocation(item.location);
    const venueId = await getOrCreateVenueId(supabase, venueName, venueAddress);
    const hostIds = await getOrCreateHostIds(supabase, parseHostNamesFromTitle(title));

    console.log('Inserting event from Google Calendar', {
      googleCalId,
      title,
      start,
      end,
      venueId,
      hostIds,
    });
    const insertedEvent = await supabase
      .from('Events')
      .insert({
        google_cal_id: googleCalId,
        title,
        start,
        end,
        location: venueId,
        description: item.description || '',
        flyer_url: null,
        price: null,
        external_url: item.htmlLink || null,
      })
      .select('id')
      .single();

    if (insertedEvent.error || !insertedEvent.data?.id) {
      throw new Error(insertedEvent.error?.message || `Failed to insert event ${googleCalId}`);
    }

    const newEventId = String(insertedEvent.data.id);
    summary.inserted += 1;

    if (hostIds.length > 0) {
      const eventHostsPayload = hostIds.map((hostId) => ({
        event_id: newEventId,
        host_id: hostId,
      }));
      const hostInsertResult = await supabase.from('event_hosts').insert(eventHostsPayload);
      if (hostInsertResult.error) {
        console.warn('Failed to insert event hosts', hostInsertResult.error.message);
      }
    }

    console.info('Successfully inserted event from Google Calendar, queuing pending event for sync', {
      googleCalId,
      eventId: newEventId,
    });

    const pendingPayload = {
      google_cal_id: googleCalId,
      event_id: newEventId,
      exclude: false,
    };

    console.info('Attempting pending_events insert for Google Calendar event', {
      googleCalId,
      eventId: newEventId,
      payloadKeys: Object.keys(pendingPayload),
    });

    console.log('Pending event payload', pendingPayload);

    const pendingInsertResult = await supabase.from('pending_events').insert(pendingPayload);
    if (!pendingInsertResult.error) {
      summary.pendingQueued += 1;
    } else {
      const pendingConflictCheck = await supabase
        .from('pending_events')
        .select('google_cal_id,event_id,exclude,created_by')
        .or(`google_cal_id.eq.${googleCalId},event_id.eq.${newEventId}`)
        .limit(5);

      console.warn('Failed to insert pending event for Google Calendar sync', {
        googleCalId,
        eventId: newEventId,
        errorMessage: pendingInsertResult.error.message,
        errorCode: pendingInsertResult.error.code,
        errorDetails: pendingInsertResult.error.details,
        errorHint: pendingInsertResult.error.hint,
        payload: pendingPayload,
        existingRowsError: pendingConflictCheck.error?.message || null,
        existingRows: pendingConflictCheck.data || [],
      });
    }
  }

  return summary;
}