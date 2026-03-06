import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { Event } from '@/lib/utils';
import { getCachedEvents } from '@/lib/utils_supabase_server';

export type SavedEventsMode = 'all' | 'upcoming' | 'past';

export type SavedEventsBuckets = {
    upcoming: Event[];
    past: Event[];
};

function isUpcomingEvent(event: Event, now: Date): boolean {
    const eventStart = new Date(`${event.startdate} ${event.starttime}`);
    return eventStart >= now;
}

export async function getSavedEventsForUserServer(userId: string, mode: SavedEventsMode = 'all'): Promise<Event[]> {
    const supabase = await createClient();

    const { data: savedRows, error } = await supabase
        .from('SavedEvents')
        .select('event_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching saved events from Supabase:', error);
        return [];
    }

    const allEvents = await getCachedEvents(false);
    const eventById = new Map(allEvents.map((event) => [event.id, event]));

    const savedEvents = (savedRows ?? [])
        .map((row: any) => eventById.get(String(row.event_id)))
        .filter((event): event is Event => !!event);

    if (mode === 'all') {
        return savedEvents;
    }

    const now = new Date();
    return savedEvents.filter((event) => (mode === 'upcoming' ? isUpcomingEvent(event, now) : !isUpcomingEvent(event, now)));
}

export async function getSavedEventsBucketsForUserServer(userId: string): Promise<SavedEventsBuckets> {
    const savedEvents = await getSavedEventsForUserServer(userId, 'all');
    const now = new Date();

    return savedEvents.reduce<SavedEventsBuckets>(
        (acc, event) => {
            if (isUpcomingEvent(event, now)) {
                acc.upcoming.push(event);
            } else {
                acc.past.push(event);
            }

            return acc;
        },
        { upcoming: [], past: [] }
    );
}

export async function getUserReviews(userId: string): Promise<any[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('Reviews')
        .select('id, event_id, rating, comment, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error('Error fetching user reviews from Supabase:', error);
        return [];
    }

    return data;
}

export async function getVenueById(venueId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('Venues')
        .select('*')
        .eq('id', venueId)
        .maybeSingle(); 
        
    if (error) {
        console.error('Error fetching venue from Supabase:', error);
        return null;
    }

    return data;
}

 
export async function getAllFollowedVenues(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('UserFollowedVenues')
        .select('*')
        .eq('user_id', userId);
        
    if (error) {
        console.error('Error fetching followed venues from Supabase:', error);
        return [];
    }

    return data;
}   