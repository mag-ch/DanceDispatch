import { getEventById, getEventReviews, getRelatedEvents, getHostPreviousEventReviews, getVenuePreviousEventReviews } from '@/lib/utils_supabase_server';
import { getVenueById } from '@/lib/server_utils';
import { notFound } from 'next/navigation';
import { EventDetailClient } from './EventDetailClient';
import { EventReview } from '@/lib/utils';

type EventDetailPageProps = {
    params: Promise<{ eventId: string }>;
    searchParams?: Promise<{
        showReviewModal?: string | string[];
    }>;
    showReviewModal?: boolean;
};

function parseBooleanParam(value?: string | string[]): boolean | undefined {
    const rawValue = Array.isArray(value) ? value[0] : value;
    if (!rawValue) return undefined;

    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    return undefined;
}

export default async function EventDetailPage({ params, searchParams, showReviewModal = false }: EventDetailPageProps) {
    const { eventId } = await params;
    const resolvedSearchParams = await searchParams;
    const showReviewModalFromRoute = parseBooleanParam(resolvedSearchParams?.showReviewModal);
    const shouldShowReviewModal = showReviewModalFromRoute ?? showReviewModal;
    
    // Fetch all data in parallel on the server
    const [event, eventReviews, relatedEvents] = await Promise.all([
        getEventById(eventId),
        getEventReviews(eventId),
        getRelatedEvents(eventId) // You can implement this function to fetch related events based on the current event's details
    ]);

    if (!event) {
        notFound();
    }
    const venue = await getVenueById(event.locationid);
    
    // Fetch host reviews from previous events
    const hostPreviousReviewsMap = new Map<string, EventReview[]>();
    if (event.hostIDs && event.hostIDs.length > 0) {
        for (const hostId of event.hostIDs) {
            const reviews = await getHostPreviousEventReviews(hostId);
            hostPreviousReviewsMap.set(hostId, Array.from(reviews.values()).flat());
        }
    }

    const venuePreviousReviewsMap = new Map<string, EventReview[]>();
    if (venue?.id) {
        const reviews = await getVenuePreviousEventReviews(venue.id);
        venuePreviousReviewsMap.set(String(venue.id), Array.from(reviews.values()).flat());
    }

    return (
        <EventDetailClient 
            event={event} 
            eventReviews={eventReviews} 
            relatedEvents={relatedEvents} 
            venueAddress={venue ? venue.address : ''}
            showReviewModal={shouldShowReviewModal}
            hostPreviousReviewsMap={hostPreviousReviewsMap}
            venuePreviousReviewsMap={venuePreviousReviewsMap}
        />
    );
}