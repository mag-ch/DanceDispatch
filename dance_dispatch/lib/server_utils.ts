import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { Event } from '@/lib/utils';
import { getCachedEvents, getUsers } from '@/lib/utils_supabase_server';
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
        .select('id, event_id, rating, comment, created_at, ReviewMedia(storage_path)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user reviews from Supabase:', error);
        return [];
    }

    if (data) {
        const allEvents = await getCachedEvents(false);
        const eventById = new Map(allEvents.map((event) => [event.id, event]));
        data.forEach((review: any) => {
            const event = eventById.get(String(review.event_id));
            review.event_title = event ? event.title : 'Unknown Event';
            review.mediaPaths = (review.ReviewMedia ?? []).map((m: any) => m.storage_path);
            delete review.ReviewMedia;
        });
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

export async function getVenueComments(venueId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('Reviews')
        .select('id, event_id, user_id, rating, comment, created_at, privacy_level, ReviewMedia(storage_path)')
        .eq('entity_id', venueId)
        .eq('entity_type', 'venue')
        .neq('privacy_level', 'private');

    if (error) {
        console.error('Error fetching venue comments from Supabase:', error);
        return null;
    }

    const users = await getUsers();
    const usernameById = new Map(users.map((user) => [String(user.id), user.username]));

    data.forEach((comment: any) => {
        comment.username = comment.privacy_level === 'anonymous'
            ? 'Anonymous'
            : usernameById.get(String(comment.user_id)) ?? 'Anon';
        comment.mediaPaths = (comment.ReviewMedia ?? []).map((m: any) => m.storage_path);
        delete comment.user_id;
        delete comment.ReviewMedia;
    });

    return data;
}

export async function getHostComments(hostId:string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('Reviews')
        .select('event_id, user_id, rating, comment, created_at, privacy_level')
        .eq('entity_id', hostId)
        .eq('entity_type', 'host')
        .neq('privacy_level', 'private');
        
    if (error) {
        console.error('Error fetching host comments from Supabase:', error);
        return null;
    }

    const users = await getUsers();
    const usernameById = new Map(users.map((user) => [String(user.id), user.username]));

    data.forEach((comment: any) => {
        comment.user_id = usernameById.get(String(comment.user_id)) || 'Anon';
    });

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

export type UserPointsSummary = {
    totalPoints: number;
    breakdown: Record<string, number>;
};

export type CompactUserBadge = {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    sortOrder: number;
    unlockedAt: string;
};

const BADGE_TIER_RANK: Record<CompactUserBadge['tier'], number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
};


export async function getUserPointsSummary(userId: string): Promise<UserPointsSummary> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('UserPoints')
        .select('points, action')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user points from Supabase:', error);
        return { totalPoints: 0, breakdown: {} };
    }

    return (data ?? []).reduce<UserPointsSummary>(
        (acc, row: any) => {
            const points = Number(row.points ?? 0);
            const safePoints = Number.isFinite(points) ? points : 0;
            const action = String(row.action ?? 'other');

            acc.totalPoints += safePoints;
            acc.breakdown[action] = (acc.breakdown[action] ?? 0) + safePoints;
            return acc;
        },
        { totalPoints: 0, breakdown: {} }
    );
    }

/**
 * Fetches top badges for multiple users in a single query.
 * Useful for compact username displays in lists/leaderboards.
 */
export async function getTopBadgesForUsers(
    userIds: string[],
    maxBadgesPerUser = 1,
): Promise<Record<string, CompactUserBadge[]>> {
    const uniqueUserIds = [...new Set(userIds.map((id) => String(id).trim()).filter(Boolean))];
    const safeLimit = Math.max(1, Math.min(5, maxBadgesPerUser));

    if (uniqueUserIds.length === 0) {
        return {};
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('user_badges')
        .select('user_id, unlocked_at, badges!inner(id, code, name, icon, tier, sort_order, is_active)')
        .in('user_id', uniqueUserIds)
        .order('unlocked_at', { ascending: false });

    if (error) {
        console.error('Error fetching top badges for users from Supabase:', error);
        return uniqueUserIds.reduce<Record<string, CompactUserBadge[]>>((acc, userId) => {
            acc[userId] = [];
            return acc;
        }, {});
    }

    const grouped = uniqueUserIds.reduce<Record<string, CompactUserBadge[]>>((acc, userId) => {
        acc[userId] = [];
        return acc;
    }, {});

    for (const row of data ?? []) {
        const userId = String((row as any).user_id ?? '').trim();
        const badge = (row as any).badges as
            | {
                  id?: unknown;
                  code?: unknown;
                  name?: unknown;
                  icon?: unknown;
                  tier?: unknown;
                  sort_order?: unknown;
                  is_active?: unknown;
              }
            | null;

        if (!userId || !badge || badge.is_active === false) {
            continue;
        }

        const tierRaw = String(badge.tier ?? 'bronze').toLowerCase();
        const tier: CompactUserBadge['tier'] =
            tierRaw === 'silver' || tierRaw === 'gold' || tierRaw === 'platinum' ? tierRaw : 'bronze';

        grouped[userId].push({
            id: String(badge.id ?? ''),
            code: String(badge.code ?? ''),
            name: String(badge.name ?? ''),
            icon: typeof badge.icon === 'string' ? badge.icon : null,
            tier,
            sortOrder: Number(badge.sort_order ?? 0),
            unlockedAt: String((row as any).unlocked_at ?? ''),
        });
    }

    for (const userId of Object.keys(grouped)) {
        grouped[userId] = grouped[userId]
            .filter((badge) => badge.id && badge.code && badge.name)
            .sort((a, b) => {
                const tierDiff = BADGE_TIER_RANK[b.tier] - BADGE_TIER_RANK[a.tier];
                if (tierDiff !== 0) return tierDiff;

                const sortOrderDiff = a.sortOrder - b.sortOrder;
                if (sortOrderDiff !== 0) return sortOrderDiff;

                return Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt);
            })
            .slice(0, safeLimit);
    }

    return grouped;
}