import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { PUSH_TEST_USER_ID } from '@/lib/push-notification-constants';
import { getEvents, getPublicReviewFeed } from '@/lib/utils_supabase_server';
import PushAnnouncementsClient from './PushAnnouncementsClient';

export default async function PushAnnouncementsPage() {
  const user = await requireAuth();
  if (user.id !== PUSH_TEST_USER_ID) redirect('/');

  const [events, reviews] = await Promise.all([
    getEvents(false),
    getPublicReviewFeed(100),
  ]);

  return (
    <PushAnnouncementsClient
      events={events.map(({ id, title, startdate, location }) => ({ id, title, startdate, location }))}
      reviews={reviews
        .filter((review) => review.id && (review.userId ?? review.user_id))
        .map((review) => ({
          id: String(review.id),
          eventName: review.eventName,
          username: review.username,
          userId: String(review.userId ?? review.user_id),
          comment: review.mainComment ?? '',
        }))}
    />
  );
}