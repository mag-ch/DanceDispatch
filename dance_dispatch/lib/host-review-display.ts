import type { EventReview } from './utils';

export type HostComment = {
    id: string;
    event_id: string;
    eventName: string;
    username: string;
    userId?: string;
    rating: number | null;
    comment: string | null;
    created_at: string;
    privacy_level: 'public' | 'anonymous';
    entity_type: 'event' | 'host';
    mediaPaths: string[];
};

export function recentHostComments(comments: HostComment[], now: Date): HostComment[] {
    const cutoff = new Date(now);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    return comments
        .filter((comment) => {
            const date = Date.parse(comment.created_at);
            return date >= cutoff.getTime() && date <= now.getTime() &&
                (Boolean(comment.comment?.trim()) || Number(comment.rating) > 0 || comment.mediaPaths.length > 0);
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function toHostEventReview(comment: HostComment, host: { id: string; name: string }): EventReview {
    const review: EventReview = {
        id: comment.id,
        eventId: comment.event_id,
        eventName: comment.eventName,
        username: comment.username,
        userId: comment.userId,
        dateSubmitted: comment.created_at,
        privacyLevel: comment.privacy_level,
        mediaPaths: comment.mediaPaths,
    };
    if (comment.entity_type === 'event') {
        review.mainComment = comment.comment ?? '';
        review.rating = comment.rating ?? 0;
    } else {
        review.djReviews = [{
            djId: host.id,
            djName: host.name,
            rating: comment.rating ?? 0,
            comments: comment.comment ?? '',
        }];
    }
    return review;
}
