import { getPublicReviewFeed, getReviewActivityHighlights } from '@/lib/utils_supabase_server';
import ReviewFeedClient from './ReviewFeedClient';
import { getRecentActivitySections } from '@/lib/recent-activity';
import { getCurrentUserId } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Activity Feed',
  description: 'Explore community reviews, comments, RSVPs, and events from your follows.',
};

export default async function ReviewFeedPage() {
  const [reviews, highlights, userId] = await Promise.all([
    getPublicReviewFeed(60),
    getReviewActivityHighlights(),
    getCurrentUserId(),
  ]);
  const activity = await getRecentActivitySections(userId ?? undefined, true);
  return (
    <div className="px-4 py-4 sm:mx-auto sm:max-w-3xl sm:py-8 lg:relative lg:left-1/2 lg:mx-0 lg:w-[75vw] lg:max-w-none lg:-translate-x-1/2 lg:px-6">
      <h1 className="text-xl font-bold text-text sm:text-2xl">Activity Feed</h1>
      <p className="mt-1 text-sm text-muted">
        Reviews, comments, friend RSVPs, and upcoming events from your follows.
      </p>

      <div className="mt-6">
        <ReviewFeedClient
          initialReviews={reviews}
          initialHighlights={highlights}
          activity={{ ...activity, fromFollows: [], reviewsAndComments: activity.reviewsAndComments.filter((item) => item.type === 'comment') }}
          signedIn={Boolean(userId)}
        />
      </div>
    </div>
  );
}
