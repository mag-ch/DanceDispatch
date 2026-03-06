import { getEventById, getEventReviews } from '@/lib/utils_supabase_server';
import { getVenueById } from '@/lib/server_utils';
import { notFound } from 'next/navigation';
import { EventDetailClient } from './EventDetailClient';

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    
    // Fetch all data in parallel on the server
    const [event, eventReviews] = await Promise.all([
        getEventById(eventId),
        getEventReviews(eventId),
    ]);

    if (!event) {
        notFound();
    }
    const venue = await getVenueById(event.locationid);

    return (
        <EventDetailClient 
            event={event} 
            eventReviews={eventReviews} 
            relatedEvents={[]} 
            venueAddress={venue ? venue.address : ''}
        />
    );
}