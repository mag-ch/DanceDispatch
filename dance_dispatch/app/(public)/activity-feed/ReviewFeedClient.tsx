'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DisplayEventReview } from '@/app/components/EventReview';
import { SaveEventButton } from '@/app/components/SaveEventButton';
import { EventReview, ReviewActivityHighlight } from '@/lib/utils';
import { Star } from 'lucide-react';
import type { ActivitySections, RecentActivityItem } from '@/lib/recent-activity';
import { ACTIVITY_CATEGORIES, buildActivityFeed, isFeedItemSelected, toggleActivityCategory, type ActivityCategory } from '@/lib/activity-feed-filters';
import styles from './ReviewFeedClient.module.css';

interface ReviewFeedClientProps {
    initialReviews: EventReview[];
    initialHighlights: ReviewActivityHighlight[];
    activity: ActivitySections;
    signedIn: boolean;
}

const CATEGORY_STYLES: Record<ActivityCategory, { label: string; color: string }> = {
    reviews: { label: 'Reviews', color: styles.reviews },
    comments: { label: 'Comments', color: styles.comments },
    rsvps: { label: 'RSVPs', color: styles.rsvps },
    new_events: { label: 'New Events', color: styles.newEvents },
};

function formatActivityDate(value: string, eventDate = false): string {
    const date = new Date(eventDate ? `${value}Z` : value);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    }).format(date);
}

function ActivityFeedCard({ item, category }: { item: RecentActivityItem; category: ActivityCategory }) {
    return (
        <article className={`${styles.activityCard} ${CATEGORY_STYLES[category].color} rounded-lg p-4`}>
            <div className="flex items-center gap-2">
                {item.actorAvatar && <img src={item.actorAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />}
                <Link href={item.href} className="font-semibold text-text hover:underline">{item.title}</Link>
                <span className={`${styles.badge} ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase`}>
                    {CATEGORY_STYLES[category].label}
                </span>
            </div>
            {item.eventTitle && (
                <Link href={item.href} className="mt-3 flex items-center gap-3">
                    <img src={item.imageUrl || '/images/default_events.jpg'} alt="" className="h-12 w-12 rounded-md object-cover" />
                    <div className="min-w-0">
                        <p className="font-semibold text-text">{item.eventTitle}</p>
                        <p className="text-xs text-muted">
                            {[item.eventDate ? formatActivityDate(item.eventDate, true) : '', item.venueName].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </Link>
            )}
            {item.excerpt && <p className="mt-3 text-sm text-text">{item.excerpt}</p>}
            <p className="mt-2 text-xs text-muted">
                {category === 'new_events' ? 'Posted' : category === 'rsvps' ? 'RSVPed' : 'Commented'} {formatActivityDate(item.createdAt)} UTC
            </p>
            {category === 'new_events' && item.eventId && (
                <div className="mt-3">
                    <SaveEventButton eventId={item.eventId} showLabel />
                </div>
            )}
            {item.entityEvents && (
                <div className="mt-3 space-y-2">
                    {item.entityEvents.map((event) => (
                        <Link key={event.id} href={event.href} className="flex items-center gap-3 hover:underline">
                            <img src={event.imageUrl || '/images/default_events.jpg'} alt="" className="h-10 w-10 rounded-md object-cover" />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-text">{event.title}</span>
                                <span className="block text-xs text-muted">{formatActivityDate(event.date, true)}</span>
                            </span>
                        </Link>
                    ))}
                    {(item.moreCount ?? 0) > 0 && (
                        <Link href={item.href} className="text-xs font-semibold text-accent hover:underline">
                            View more ({item.moreCount})
                        </Link>
                    )}
                </div>
            )}
            {item.nextHref && item.nextDate && (
                <Link href={item.nextHref} className="mt-3 block text-xs font-semibold text-accent hover:underline">
                    Next{item.nextLabel ? ` from ${item.nextLabel}` : ''}: {formatActivityDate(item.nextDate, true)}
                </Link>
            )}
        </article>
    );
}

export default function ReviewFeedClient({ initialReviews, initialHighlights, activity, signedIn }: ReviewFeedClientProps) {
    const [reviews, setReviews] = useState(initialReviews);
    const [deletedReviewIds, setDeletedReviewIds] = useState<string[]>([]);
    const [activeCategories, setActiveCategories] = useState<ActivityCategory[]>([...ACTIVITY_CATEGORIES]);
    const feed = buildActivityFeed(reviews, activity).filter((item) =>
        item.kind !== 'review' || !item.review.id || !deletedReviewIds.includes(item.review.id));
    const visibleItems = feed.filter((item) => isFeedItemSelected(item, activeCategories));
    const counts = Object.fromEntries(ACTIVITY_CATEGORIES.map((category) => [
        category, feed.reduce((total, item) => {
            if (item.kind === 'activity') return total + Number(item.category === category);
            return total + Number(item.inReviewFeed && item.category === category) + (category === 'comments' ? item.replies.length : 0);
        }, 0),
    ])) as Record<ActivityCategory, number>;

    return (
        <>
            <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter activity categories">
                {ACTIVITY_CATEGORIES.map((category) => (
                    <button
                        key={category}
                        type="button"
                        aria-pressed={activeCategories.includes(category)}
                        onClick={() => setActiveCategories((current) => toggleActivityCategory(current, category))}
                        className={`${styles.chip} ${CATEGORY_STYLES[category].color} rounded-full border px-3 py-2 text-sm font-medium transition-colors sm:px-4 sm:text-base`}
                    >
                        {CATEGORY_STYLES[category].label} ({counts[category]})
                    </button>
                ))}
                <button type="button" onClick={() => setActiveCategories([])} className="rounded-full border border-default bg-surface px-3 py-2 text-sm text-muted hover:text-text">
                    Clear all
                </button>
            </div>
            {initialHighlights.length > 0 && (
                <section className="mb-8" aria-labelledby="review-highlights-heading">
                    <div className="mb-4">
                        <h2 id="review-highlights-heading" className="text-lg font-bold text-text sm:text-xl">Most Reviewed</h2>
                        <p className="mt-1 text-sm text-muted">DJs and venues with the most community feedback.</p>
                    </div>
                    <div className="-mx-2 overflow-x-auto px-2 pb-3">
                        <div className="flex snap-x snap-mandatory gap-3">
                            {initialHighlights.map((highlight) => (
                                <article key={`${highlight.entityType}-${highlight.entityId}`} className="w-[min(82vw,320px)] shrink-0 snap-start rounded-lg border border-default bg-surface p-4 sm:w-[320px]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                                {highlight.entityType === 'host' ? 'DJ' : 'Venue'}
                                            </p>
                                            <Link
                                                href={`/${highlight.entityType === 'host' ? 'hosts' : 'venues'}/${highlight.entityId}`}
                                                className="mt-1 block truncate font-semibold text-text hover:underline"
                                            >
                                                {highlight.entityName}
                                            </Link>
                                        </div>
                                        <span className="shrink-0 text-right text-sm font-bold text-text">
                                            {highlight.reviewCount}<span className="block text-[10px] font-medium text-muted">total reviews</span>
                                        </span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                                        <span>{highlight.reviewsThisWeek} past week</span>
                                        <span>{highlight.reviewsThisMonth} past month</span>
                                    </div>
                                    <div className="mt-3 space-y-3">
                                        {highlight.previews.map((preview) => (
                                            <div key={preview.id} className="border-t border-default pt-3 first:border-0 first:pt-0">
                                                {preview.rating !== null && preview.rating > 0 && (
                                                    <div className="mb-1 flex gap-0.5" aria-label={`${preview.rating} out of 5 stars`}>
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star key={star} size={13} className={star <= preview.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                                                        ))}
                                                    </div>
                                                )}
                                                {preview.comment ? (
                                                    <p className="line-clamp-2 text-sm text-text">&ldquo;{preview.comment}&rdquo;</p>
                                                ) : (
                                                    <p className="text-xs italic text-muted">Rating only</p>
                                                )}
                                                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted">
                                                    <span className="shrink-0">{preview.username}</span>
                                                    <span aria-hidden="true">&middot;</span>
                                                    <Link href={`/events/${preview.eventId}`} className="truncate font-medium text-accent hover:underline">
                                                        {preview.eventName}
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {activeCategories.length === 0 ? (
                <p className="text-sm text-muted">Select an activity category to see its feed.</p>
            ) : visibleItems.length === 0 ? (
                <p className="text-sm text-muted">
                    No activity in the selected categories.{!signedIn && ' Sign in and follow people, hosts, or venues to see personalized activity.'}
                </p>
            ) : (
                <section aria-label="Activity feed">
                    <p className="mb-4 text-xs text-muted">Newest activity first.</p>
                    <div className="space-y-5">
                        {visibleItems.map((item) => item.kind === 'activity' ? (
                            <ActivityFeedCard key={`${item.category}-${item.activity.id}`} item={item.activity} category={item.category} />
                        ) : (
                            <article key={`${item.category}-${item.review.id ?? `${item.review.eventId}-${item.review.username}-${item.review.dateSubmitted}`}`}
                                className={`${styles.activityCard} ${CATEGORY_STYLES[item.category].color} rounded-lg p-4`}>
                                <Link href={`/events/${item.review.eventId}`} className="mb-2 flex items-center gap-3">
                                    <img src={item.review.eventImageUrl || '/images/default_events.jpg'} alt=""
                                        className="h-12 w-12 shrink-0 rounded-md border border-default object-cover" />
                                    <span className="text-sm font-semibold text-text hover:underline">{item.review.eventName}</span>
                                    <span className={`${styles.badge} rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide`}>
                                        {item.review.isPreEvent ? 'Comment' : 'Review'}
                                    </span>
                                </Link>
                                <div className="[&_video]:max-h-56 [&_img]:max-h-56 [&_video]:object-cover [&_img]:object-cover">
                                    <DisplayEventReview review={item.review}
                                        onDeleted={() => {
                                            setReviews((current) => current.filter((review) => review !== item.review));
                                            if (item.review.id) setDeletedReviewIds((current) => [...current, item.review.id!]);
                                        }} />
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
