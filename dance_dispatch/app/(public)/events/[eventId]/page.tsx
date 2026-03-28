import { getEventById, getEventReviews, getRelatedEvents } from '@/lib/utils_supabase_server';
import { getVenueById } from '@/lib/server_utils';
import { notFound } from 'next/navigation';
import { EventDetailClient } from './EventDetailClient';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    
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
    return (
        <EventDetailClient 
            event={event} 
            eventReviews={eventReviews} 
            relatedEvents={relatedEvents} 
            venueAddress={venue ? venue.address : ''}
        />
    );
}