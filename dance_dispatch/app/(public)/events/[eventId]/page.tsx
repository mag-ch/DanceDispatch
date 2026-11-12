import { getEventReviews, getRelatedEvents, getHostPreviousEventReviews, getVenuePreviousEventReviews, getVenueById, getEventByIdIncludingPending } from '@/lib/utils_supabase_server';
import { CompactUserBadge, getTopBadgesForUsers } from '@/lib/server_utils';
import { notFound } from 'next/navigation';
import { EventDetailClient } from './EventDetailClient';
import { EventReview } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from "next";
import { cache } from "react";
import { pageMetadata } from '@/lib/page-metadata';

type EventRsvpUser = {
    userId: string;
    username: string;
    profilePicture: string | null;
    savedAt: string;
    badges: CompactUserBadge[];
};

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
    const [event, eventReviews, relatedEvents, rsvpUsers] = await Promise.all([
        getEventByIdIncludingPending(eventId),
        getEventReviews(eventId),
        getRelatedEvents(eventId),
        getEventRsvpUsers(eventId),
    ]);

    if (!event) {
        notFound();
    }
    const venue = await getVenueById(event.locationid);
    
    // Fetch host reviews from previous events
    const hostPreviousReviewsMap = new Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; averageRating: number; comment: string; createdAt: string }>>();
    if (event.hostIDs && event.hostIDs.length > 0) {
        for (const hostId of event.hostIDs) {
            const reviews = await getHostPreviousEventReviews(hostId, eventId);
            hostPreviousReviewsMap.set(hostId, Array.from(reviews.values()).flat());
        }
    }

    const venuePreviousReviewsMap = new Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; averageRating: number; comment: string; createdAt: string }>>();
    if (venue?.id) {
        const reviews = await getVenuePreviousEventReviews(venue.id, eventId);
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
            rsvpUsers={rsvpUsers}
        />
    );
}

async function getEventRsvpUsers(eventId: string): Promise<EventRsvpUser[]> {
    const supabase = await createClient();

    const { data: savedRows, error: savedError } = await supabase
        .from('SavedEvents')
        .select('user_id, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(60);

    if (savedError) {
        console.error('Failed to fetch event RSVPs:', savedError);
        return [];
    }

    const dedupedRows = [] as Array<{ user_id: string; created_at: string }>;
    const seenUsers = new Set<string>();
    for (const row of savedRows ?? []) {
        const userId = String((row as any).user_id ?? '').trim();
        if (!userId || seenUsers.has(userId)) {
            continue;
        }

        seenUsers.add(userId);
        dedupedRows.push({
            user_id: userId,
            created_at: String((row as any).created_at ?? ''),
        });
    }

    const userIds = dedupedRows.map((row) => row.user_id);
    if (userIds.length === 0) {
        return [];
    }

    const [{ data: profiles, error: profilesError }, badgeMap] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, username, full_name, profile_picture')
            .in('id', userIds),
        getTopBadgesForUsers(userIds, 1),
    ]);

    if (profilesError) {
        console.error('Failed to fetch RSVP user profiles:', profilesError);
        return [];
    }

    const profileById = new Map(
        (profiles ?? []).map((profile: any) => [String(profile.id), profile]),
    );

    return dedupedRows
        .map((row) => {
            const profile = profileById.get(row.user_id);
            if (!profile) {
                return null;
            }

            const username = String(profile.username ?? '').trim();

            return {
                userId: row.user_id,
                username: username || 'User',
                profilePicture: profile.profile_picture ? String(profile.profile_picture) : null,
                savedAt: row.created_at,
                badges: badgeMap[row.user_id] ?? [],
            } satisfies EventRsvpUser;
        })
        .filter((user): user is EventRsvpUser => Boolean(user));
}

export async function generateMetadata({ params, searchParams, showReviewModal = false }: EventDetailPageProps) {
  const { eventId } = await params;
  const event = await getEventByIdIncludingPending(eventId);
  if (!event) return { title: "Event not found" };

  const when = new Date(event.starttime).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    timeZone: "America/New_York",
  });
  const venue = event.location ?? "";
  const blurb = (event.description ?? "").replace(/\s+/g, " ").slice(0, 120);
  const description = [when, venue].filter(Boolean).join(" · ") +
    (blurb ? ` — ${blurb}` : "");

  const image = event.imageurl ?? '/images/default_events.jpg'; // fallback in /public
  return pageMetadata(event.title, description, `/events/${event.id}`, image);
}