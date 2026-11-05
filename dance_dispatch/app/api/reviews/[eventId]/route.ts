import { userSubmitReview } from '@/lib/utils_supabase_server';
import { validateAndSanitizeReviews } from '@/lib/validator';
import { requireAuth } from '@/lib/auth-helpers';
import { sendReviewPushToFollowers } from '@/lib/push-notifications';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { awardPoints } from '@/lib/points';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const body = await request.json();
        const content = body?.content;
        
        // Validate and sanitize reviews
        // const { reviews, isValid, errorMessage } = validateAndSanitizeReviews(content);
        
        // if (!isValid) {
        //     return new Response(JSON.stringify({ error: `Validation failed: ${errorMessage}` }), {
        //         status: 400,
        //         headers: { 'Content-Type': 'application/json' },
        //     });
        // }

        const user = await requireAuth();
        console.log('Submitting reviews for user:', user.id, 'event:', eventId, 'content:', content);
        const allowedMediaPrefix = `events/${eventId}/${user.id}/`;
        const entries: any[] = (Array.isArray(content) ? content : []).map((entry: any) => ({
            ...entry,
            // Only the submitting user's own uploads for this event can be attached.
            mediaPaths: (Array.isArray(entry?.mediaPaths) ? entry.mediaPaths : []).filter(
                (path: unknown) => typeof path === 'string'
                    && path.startsWith(allowedMediaPrefix)
                    && !path.slice(allowedMediaPrefix.length).includes('/')
            ),
        }));
        for (const entry of entries) {
            await userSubmitReview(entry, user.id, eventId);
        }

        // A submission can hold several entries (event, venue, one per DJ). Build one award per
        // distinct entity so each is counted once. Text/rating earns the review points for that
        // entity; media earns its own points even when no written review was left.
        const hasContent = (entry: any) => Boolean(entry?.rating) || Boolean(String(entry?.comment ?? '').trim());
        const awards = new Map<string, { action: Parameters<typeof awardPoints>[1]; entityId: string }>();
        const addAward = (action: Parameters<typeof awardPoints>[1], entityId: string) =>
            awards.set(`${action}:${entityId}`, { action, entityId });

        for (const entry of entries) {
            if (hasContent(entry)) {
                if (entry?.entityType === 'host' && entry.entityId) {
                    addAward('review_dj', `${eventId}:${entry.entityId}`);
                } else if (entry?.entityType === 'venue') {
                    addAward('review_venue', `${eventId}:${entry.entityId || 'venue'}`);
                } else if (entry?.entityType === 'event') {
                    addAward('review', eventId);
                }
            }
            if (entry.mediaPaths.length > 0) {
                addAward('review_media', eventId);
            }
        }

        const supabase = await createClient();
        for (const { action, entityId } of awards.values()) {
            const awardError = await awardPoints(user.id, action, entityId, supabase);
            if (awardError) {
                console.error(`Failed to award ${action} points:`, awardError);
            }
        }

        // try {
        //     await sendReviewPushToFollowers(user.id, eventId);
        // } catch (notificationError) {
        //     console.error('Failed to send follower review notifications:', notificationError);
        // }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in POST /reviews:', error);
        return new Response(JSON.stringify({ error: 'Failed to submit review' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
}


// DELETE /api/reviews/[eventId]?userId=... - admin moderation, removes all review rows
// a user left for this event (mirrors the self-delete scope used by review owners).
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        await requireAdmin();
        const { eventId } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId')?.trim() ?? '';

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { error } = await supabase
            .from('Reviews')
            .delete()
            .eq('event_id', Number(eventId))
            .eq('user_id', userId);

        if (error) {
            console.error('Error moderating review:', error);
            return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete review';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

