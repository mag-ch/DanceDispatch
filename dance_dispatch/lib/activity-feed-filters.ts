import type { EventReview } from '@/lib/utils';
import type { ActivitySections, RecentActivityItem } from '@/lib/recent-activity';

export const ACTIVITY_CATEGORIES = ['reviews', 'comments', 'rsvps', 'new_events'] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type FeedItem =
  | { kind: 'review'; category: 'reviews' | 'comments'; date: string; review: EventReview; replies: RecentActivityItem[]; inReviewFeed: boolean }
  | { kind: 'activity'; category: 'rsvps' | 'new_events'; date: string; activity: RecentActivityItem };

export function toggleActivityCategory(selected: ActivityCategory[], category: ActivityCategory): ActivityCategory[] {
  return selected.includes(category) ? selected.filter((item) => item !== category) : [...selected, category];
}

export function buildActivityFeed(reviews: EventReview[], activity: ActivitySections): FeedItem[] {
  const reviewItems: Extract<FeedItem, { kind: 'review' }>[] = reviews.map((review) => ({
    kind: 'review', category: review.isPreEvent ? 'comments' : 'reviews', date: review.dateSubmitted, review, replies: [], inReviewFeed: true,
  }));
  const byReviewId = new Map(reviewItems.filter((item) => item.review.id).map((item) => [item.review.id!, item]));
  for (const reply of activity.reviewsAndComments) {
    if (reply.type !== 'comment' || !reply.parentReview?.id) continue;
    let item = byReviewId.get(reply.parentReview.id);
    if (!item) {
      item = {
        kind: 'review', category: reply.parentReview.isPreEvent ? 'comments' : 'reviews',
        date: reply.parentReview.dateSubmitted, review: reply.parentReview, replies: [], inReviewFeed: false,
      };
      reviewItems.push(item);
      byReviewId.set(reply.parentReview.id, item);
    }
    item.replies.push(reply);
    if (Date.parse(reply.createdAt) > Date.parse(item.date)) item.date = reply.createdAt;
  }
  const items: FeedItem[] = [
    ...reviewItems,
    ...activity.friendsGoing.map((item): FeedItem => ({
      kind: 'activity', category: 'rsvps', date: item.createdAt, activity: item,
    })),
    ...activity.followedEvents.map((item): FeedItem => ({
      kind: 'activity', category: 'new_events', date: item.createdAt, activity: item,
    })),
  ];
  return items.sort((a, b) => {
    const aTime = Date.parse(a.date);
    const bTime = Date.parse(b.date);
    return (Number.isNaN(bTime) ? -Infinity : bTime) - (Number.isNaN(aTime) ? -Infinity : aTime);
  });
}

export function isFeedItemSelected(item: FeedItem, selected: ActivityCategory[]): boolean {
  if (item.kind === 'activity') return selected.includes(item.category);
  return (item.inReviewFeed && selected.includes(item.category)) || (item.replies.length > 0 && selected.includes('comments'));
}
