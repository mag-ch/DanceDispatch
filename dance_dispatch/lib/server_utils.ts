import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { Event } from '@/lib/utils';
import { getCachedEvents } from '@/lib/utils_supabase_server';
import { combineChunks } from '@supabase/ssr';

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

    // add event title to each review
    if (data) {
        const allEvents = await getCachedEvents(false);
        const eventById = new Map(allEvents.map((event) => [event.id, event]));
        data.forEach((review: any) => {
            const event = eventById.get(String(review.event_id));
            review.event_title = event ? event.title : 'Unknown Event';
        });
    }
        
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


export async function getAggregatedVenueAttributes(venueId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('venue_attributes')
        .select('attribute, value')
        .eq('venue_id', venueId)
        .eq('data_type', 'rating');
        
    if (error) {
        console.error('Error fetching aggregated venue attributes from Supabase:', error);
        return null;
    }

    
    // group by attribute and calculate average value for each attribute
    const attributeMap: Record<string, { total: number; count: number }> = {};
    for (const row of data) {
        if (!attributeMap[row.attribute]) {
            attributeMap[row.attribute] = { total: 0, count: 0 };
        }
        attributeMap[row.attribute].total += Number(row.value);
        attributeMap[row.attribute].count += 1;
    }

    // calculate average for each attribute
    const aggregatedAttributes = Object.entries(attributeMap).map(([attribute, { total, count }]) => ({
        attribute,
        average: total / count,
    }));
    return aggregatedAttributes;
}

export async function getUniqueVenueAttributes(venueId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('venue_attributes')
        .select('attribute, value')
        .eq('venue_id', venueId)
        .eq('data_type', 'unique');
        
    if (error) {
        console.error('Error fetching unique venue attributes from Supabase:', error);
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

export async function getFollowedUsers(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('UserFollows')
        .select('followed_user_id')
        .eq('follower_user_id', userId);

    if (error) {
        console.error('Error fetching followed users from Supabase:', error);
        return [];
    }
    
    return data?.map((row) => row.followed_user_id) || [];
}