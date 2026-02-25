import { getEventById, getRelatedEvents, getEventReviews } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { EventDetailClient } from './EventDetailClient';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    
    // Fetch all data in parallel on the server
    const [event, eventReviews, relatedEventsData] = await Promise.all([
        getEventById(eventId),
        getEventReviews(eventId),
        getEventById(eventId).then(e => e ? getRelatedEvents(e, 3) : [])
    ]);

    if (!event) {
        notFound();
    }

    return (
        <EventDetailClient 
            event={event} 
            eventReviews={eventReviews} 
            relatedEvents={relatedEventsData} 
        />
    );
}