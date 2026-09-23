'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DisplayEventReview } from '@/app/components/EventReview';
import { EventReview } from '@/lib/utils';

interface ReviewFeedClientProps {
    initialReviews: EventReview[];
}

export default function ReviewFeedClient({ initialReviews }: ReviewFeedClientProps) {
    const [reviews, setReviews] = useState(initialReviews);

    if (reviews.length === 0) {
        return <p className="text-sm text-muted">No public reviews yet.</p>;
    }

    return (
        <div className="space-y-5">
            {reviews.map((review, index) => (
                <div key={`${review.eventId}-${review.username}-${index}`}>
                    <Link
                        href={`/events/${review.eventId}`}
                        className="mb-1 flex items-center gap-3"
                    >
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
                            onDeleted={() => setReviews((current) => current.filter((_, i) => i !== index))}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
