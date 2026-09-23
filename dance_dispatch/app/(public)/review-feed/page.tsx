import { getPublicReviewFeed } from '@/lib/utils_supabase_server';
import ReviewFeedClient from './ReviewFeedClient';

export const metadata = {
  title: 'Review Feed | DanceDispatch',
  description: 'See what the community is saying about recent events, venues, and hosts.',
};

export default async function ReviewFeedPage() {
  const reviews = await getPublicReviewFeed(60);

  return (
    <div className="-mx-4 px-2 py-4 sm:mx-auto sm:max-w-3xl sm:px-4 sm:py-8 lg:relative lg:left-1/2 lg:mx-0 lg:w-[75vw] lg:max-w-none lg:-translate-x-1/2 lg:px-6">
      <h1 className="text-xl font-bold text-text sm:text-2xl">Community Reviews</h1>
      <p className="mt-1 text-sm text-muted">
        Public reviews and media shared by the community, most recent first.
      </p>

      <div className="mt-6">
        <ReviewFeedClient initialReviews={reviews} />
      </div>
    </div>
  );
}
