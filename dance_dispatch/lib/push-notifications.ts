import 'server-only';

import webpush, { type PushSubscription } from 'web-push';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUSH_TEST_USER_ID } from '@/lib/push-notification-constants';
import { getEventById } from '@/lib/utils_supabase_server';

const PUSH_SUBSCRIPTIONS_TABLE = 'push_subscriptions';

type PushSubscriptionRow = {
  endpoint: unknown;
  p256dh: unknown;
  auth: unknown;
  expiration_time: unknown;
};

type UserFollowRow = {
  follower_user_id: unknown;
};

type UsernameRow = {
  username: unknown;
};

type PushPayload = {
  title: string;
  body: string;
  href?: string;
  tag?: string;
};

let serviceRoleClient: SupabaseClient | null = null;
let vapidConfigured = false;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getServiceRoleClient(): SupabaseClient {
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  serviceRoleClient = createSupabaseClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return serviceRoleClient;
}

function ensureVapidConfiguration(): void {
  if (vapidConfigured) {
    return;
  }

  webpush.setVapidDetails(
    getRequiredEnv('VAPID_SUBJECT'),
    getRequiredEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY'),
    getRequiredEnv('VAPID_PRIVATE_KEY')
  );

  vapidConfigured = true;
}

function normalizeSubscriptionPayload(subscription: PushSubscriptionJSON): PushSubscription {
  const endpoint = String(subscription.endpoint ?? '').trim();
  const p256dh = String(subscription.keys?.p256dh ?? '').trim();
  const auth = String(subscription.keys?.auth ?? '').trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription payload');
  }

  return {
    endpoint,
    expirationTime:
      typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
    keys: {
      p256dh,
      auth,
    },
  };
}

function mapRowToSubscription(row: PushSubscriptionRow): PushSubscription | null {
  const endpoint = String(row.endpoint ?? '').trim();
  const p256dh = String(row.p256dh ?? '').trim();
  const auth = String(row.auth ?? '').trim();

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  const expirationTime =
    typeof row.expiration_time === 'number' ? row.expiration_time : Number(row.expiration_time ?? NaN);

  return {
    endpoint,
    expirationTime: Number.isFinite(expirationTime) ? expirationTime : null,
    keys: { p256dh, auth },
  };
}

export function getPushPublicKey(): string {
  return getRequiredEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionJSON,
  userAgent?: string
): Promise<void> {
  const supabase = getServiceRoleClient();
  const normalized = normalizeSubscriptionPayload(subscription);

  const { error } = await supabase.from(PUSH_SUBSCRIPTIONS_TABLE).upsert(
    {
      user_id: userId,
      endpoint: normalized.endpoint,
      p256dh: normalized.keys.p256dh,
      auth: normalized.keys.auth,
      expiration_time: normalized.expirationTime,
      user_agent: userAgent?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'endpoint',
      ignoreDuplicates: false,
    }
  );

  if (error) {
    throw new Error(error.message || 'Failed to save push subscription');
  }
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint) {
    throw new Error('A subscription endpoint is required');
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from(PUSH_SUBSCRIPTIONS_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', normalizedEndpoint);

  if (error) {
    throw new Error(error.message || 'Failed to delete push subscription');
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  // Ensure web-push has VAPID credentials configured exactly once before sending.
  ensureVapidConfiguration();

  // Create or reuse the service-role Supabase client used for server-side reads/writes.
  const supabase = getServiceRoleClient();
  // Load all push subscriptions for the target user.
  const { data, error } = await supabase
    .from(PUSH_SUBSCRIPTIONS_TABLE)
    .select('endpoint,p256dh,auth,expiration_time')
    .eq('user_id', userId);

  // If the query failed, surface a clear error to the caller.
  if (error) {
    throw new Error(error.message || 'Failed to load push subscriptions');
  }

  // Convert raw DB rows into valid Web Push subscription objects.
  const subscriptions = (data ?? [])
    .map((row) => mapRowToSubscription(row as PushSubscriptionRow))
    .filter((row): row is PushSubscription => Boolean(row));

  // Exit early when the user has no valid subscriptions.
  if (subscriptions.length === 0) {
    return { sent: 0, removed: 0 };
  }

  // Track endpoints that should be deleted after failed sends (expired or gone).
  const endpointsToDelete: string[] = [];
  // Count successfully delivered notifications.
  let sent = 0;

  // Attempt to send the payload to each saved subscription.
  for (const subscription of subscriptions) {
    try {
      // Send one Web Push notification using the current subscription.
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      // Increment success count when send does not throw.
      sent += 1;
    } catch (error) {
      // Extract provider HTTP status code when available (for expiration detection).
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : NaN;

      // 404/410 indicate invalid or expired subscriptions; mark for cleanup and continue.
      if (statusCode === 404 || statusCode === 410) {
        endpointsToDelete.push(subscription.endpoint);
        continue;
      }

      // Re-throw unexpected errors so upstream callers can handle/report them.
      throw error;
    }
  }

  // Remove stale endpoints discovered during send attempts.
  if (endpointsToDelete.length > 0) {
    const { error: cleanupError } = await supabase
      .from(PUSH_SUBSCRIPTIONS_TABLE)
      .delete()
      .in('endpoint', endpointsToDelete);

    // Log cleanup issues without failing the entire send operation result.
    if (cleanupError) {
      console.error('Failed to clean up expired push subscriptions:', cleanupError);
    }
  }

  // Return the number of successful sends and removed stale subscriptions.
  return { sent, removed: endpointsToDelete.length };
}

export async function sendReviewPushToFollowers(
  reviewerUserId: string,
  eventId: string
): Promise<{ followers: number; notified: number; removed: number }> {
  const normalizedReviewerId = reviewerUserId.trim();
  const normalizedEventId = eventId.trim();

  if (!normalizedReviewerId || !normalizedEventId) {
    return { followers: 0, notified: 0, removed: 0 };
  }

  const supabase = getServiceRoleClient();
  const { data: followRows, error: followsError } = await supabase
    .from('UserFollows')
    .select('follower_user_id')
    .eq('followed_user_id', normalizedReviewerId);

  if (followsError) {
    throw new Error(followsError.message || 'Failed to load followers for review notification');
  }

  const followerIds = [...new Set(
    (followRows ?? [])
      .map((row) => String((row as UserFollowRow).follower_user_id ?? '').trim())
      .filter((id) => Boolean(id) && id !== normalizedReviewerId)
  )];

  if (followerIds.length === 0) {
    return { followers: 0, notified: 0, removed: 0 };
  }

  let reviewerName = 'Someone you follow';
  const { data: reviewerRow } = await supabase
    .from('Users')
    .select('username')
    .eq('id', normalizedReviewerId)
    .maybeSingle();

  const loadedName = String((reviewerRow as UsernameRow | null)?.username ?? '').trim();
  if (loadedName) {
    reviewerName = loadedName;
  }

  let eventName = 'an event';
  const event = await getEventById(normalizedEventId);
  const loadedEventName = String(event?.title ?? '').trim();
  if (loadedEventName) {
    eventName = loadedEventName;
  }

  const payload: PushPayload = {
    title: `New review from ${reviewerName}`,
    body: `${reviewerName} posted a review for ${eventName}`,
    href: `/events/${encodeURIComponent(normalizedEventId)}`,
    tag: `review-${normalizedEventId}`,
  };

  let notified = 0;
  let removed = 0;

  for (const followerId of followerIds) {
    const { error: insertError } = await supabase
      .from('user_notifications')
      .insert({
        user_id: followerId,
        actor_user_id: normalizedReviewerId,
        type: 'followed_user_review',
        title: payload.title,
        body: payload.body,
        href: payload.href ?? '/notifications',
        metadata: {
          reviewerId: normalizedReviewerId,
          reviewerName,
          eventId: normalizedEventId,
          eventName,
        },
      });

    if (insertError) {
      console.error(`Failed to persist review notification for follower ${followerId}:`, insertError);
    }

    try {
      const result = await sendPushToUser(followerId, payload);
      if (result.sent > 0) {
        notified += 1;
      }
      removed += result.removed;
    } catch (error) {
      console.error(`Failed to send review push notification to follower ${followerId}:`, error);
    }
  }

  return { followers: followerIds.length, notified, removed };
}