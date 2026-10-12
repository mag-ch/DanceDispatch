'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DisplayEventReview } from '@/app/components/EventReview';
import { EventReview, ReviewActivityHighlight } from '@/lib/utils';
import { Star } from 'lucide-react';

interface ReviewFeedClientProps {
    initialReviews: EventReview[];
    initialHighlights: ReviewActivityHighlight[];
}

export default function ReviewFeedClient({ initialReviews, initialHighlights }: ReviewFeedClientProps) {
    const [reviews, setReviews] = useState(initialReviews);

    return (
        <>
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

            {reviews.length === 0 ? (
                <p className="text-sm text-muted">No public reviews yet.</p>
            ) : (
                <div className="space-y-5">
                    {reviews.map((review, index) => (
                        <div key={`${review.eventId}-${review.username}-${index}`}>
                            <Link href={`/events/${review.eventId}`} className="mb-1 flex items-center gap-3">
                                <img
                                    src={review.eventImageUrl || '/images/default_events.jpg'}
                                    alt=""
                                    className="h-12 w-12 shrink-0 rounded-md border border-default object-cover"
                                />
                                <span className="text-sm font-semibold text-text hover:underline">{review.eventName}</span>
                            </Link>
                            <div className="[&_video]:max-h-56 [&_img]:max-h-56 [&_video]:object-cover [&_img]:object-cover">
                                <DisplayEventReview
                                    review={review}
                                    onDeleted={() => setReviews((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
