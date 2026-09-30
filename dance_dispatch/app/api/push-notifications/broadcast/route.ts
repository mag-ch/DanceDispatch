import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getEventById } from '@/lib/utils_supabase_server';
import { PUSH_TEST_USER_ID } from '@/lib/push-notification-constants';
import { sendPushToAllUsers, sendPushToUsers } from '@/lib/push-notifications';
import { createClient as createServerClient } from '@/lib/supabase/server';

type BroadcastMode = 'message' | 'review-request' | 'new-review' | 'new-event';

async function getRsvpUserIds(eventId: string): Promise<string[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('SavedEvents')
    .select('user_id')
    .eq('event_id', eventId);

  if (error) {
    throw new Error(error.message || 'Failed to load RSVP users for this event.');
  }

  return (data ?? [])
    .map((row) => String((row as { user_id?: unknown }).user_id ?? '').trim())
    .filter(Boolean);
}

async function getFollowerUserIds(followedUserId: string): Promise<string[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('UserFollows')
    .select('follower_user_id')
    .eq('followed_user_id', followedUserId);

  if (error) {
    throw new Error(error.message || 'Failed to load followers for this review.');
  }

  return (data ?? [])
    .map((row) => String((row as { follower_user_id?: unknown }).follower_user_id ?? '').trim())
    .filter((id) => Boolean(id) && id !== followedUserId);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (user.id !== PUSH_TEST_USER_ID) {
      return NextResponse.json({ error: 'Only the configured owner can send announcements.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const mode = body?.mode as BroadcastMode | undefined;
    if (!['message', 'review-request', 'new-review', 'new-event'].includes(mode ?? '')) {
      return NextResponse.json({ error: 'Choose a valid announcement type.' }, { status: 400 });
    }

    let title = '';
    let message = '';
    let href = '/notifications';
    let tag = `broadcast-${randomUUID()}`;
    let recipientUserIds: string[] | null = null;

    if (mode === 'message') {
      title = typeof body?.title === 'string' ? body.title.trim() : '';
      message = typeof body?.message === 'string' ? body.message.trim() : '';
      if (!title || !message || title.length > 80 || message.length > 240) {
        return NextResponse.json({ error: 'Title (1-80 chars) and message (1-240 chars) are required.' }, { status: 400 });
      }

      const rawUserIds = Array.isArray(body?.userIds) ? body.userIds : [];
      const userIds = rawUserIds
        .map((id: unknown) => String(id ?? '').trim())
        .filter((id: string): id is string => Boolean(id));
      if (userIds.length > 0) {
        recipientUserIds = userIds;
      }
    } else if (mode === 'new-review') {
      const reviewId = typeof body?.reviewId === 'string' ? body.reviewId.trim() : '';
      if (!reviewId) {
        return NextResponse.json({ error: 'Select a review for this announcement.' }, { status: 400 });
      }

      const supabase = await createServerClient();
      const { data: reviewRow, error: reviewError } = await supabase
        .from('Reviews')
        .select('id, event_id, user_id')
        .eq('id', Number(reviewId))
        .maybeSingle();

      if (reviewError || !reviewRow) {
        return NextResponse.json({ error: 'The selected review could not be found.' }, { status: 404 });
      }

      const reviewerId = String((reviewRow as { user_id?: unknown }).user_id ?? '').trim();
      const eventIdForReview = String((reviewRow as { event_id?: unknown }).event_id ?? '').trim();
      const event = eventIdForReview ? await getEventById(eventIdForReview) : null;
      const eventName = event?.title.trim() || 'an event';

      href = event ? `/events/${encodeURIComponent(event.id)}` : '/notifications';
      tag = `broadcast-new-review-${reviewId}-${randomUUID()}`;
      title = 'New review posted';
      message = `A new review is available for ${eventName}.`;

      if (body?.followersOnly === true) {
        if (!reviewerId) {
          return NextResponse.json({ error: 'This review has no identifiable author to filter followers by.' }, { status: 400 });
        }
        recipientUserIds = await getFollowerUserIds(reviewerId);
        if (recipientUserIds.length === 0) {
          return NextResponse.json({ error: 'This reviewer has no followers to notify.' }, { status: 400 });
        }
      }
    } else {
      const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : '';
      if (!eventId) {
        return NextResponse.json({ error: 'Select an event for this announcement.' }, { status: 400 });
      }
      const event = await getEventById(eventId);
      if (!event) {
        return NextResponse.json({ error: 'The selected event could not be found.' }, { status: 404 });
      }

      const eventName = event.title.trim();
      href = `/events/${encodeURIComponent(event.id)}`;
      tag = `broadcast-${mode}-${event.id}-${randomUUID()}`;

      if (mode === 'review-request') {
        title = 'Write a review';
        message = `Have you been to ${eventName}? Leave a review and share your experience.`;
        href = `/events/${encodeURIComponent(event.id)}?showReviewModal=true`;

        if (body?.rsvpOnly === true) {
          recipientUserIds = await getRsvpUserIds(event.id);
          if (recipientUserIds.length === 0) {
            return NextResponse.json({ error: 'No RSVP\'ed users were found for this event.' }, { status: 400 });
          }
        }
      } else {
        title = 'New event posted';
        message = `${eventName} is now on DanceDispatch. Check it out!`;
      }
    }

    const payload = { title, body: message, href, tag };
    const result = recipientUserIds
      ? await sendPushToUsers(recipientUserIds, payload)
      : await sendPushToAllUsers(payload);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send announcement.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}