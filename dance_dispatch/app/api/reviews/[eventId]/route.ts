import { userSubmitReview } from '@/lib/utils_supabase_server';
import { validateAndSanitizeReviews } from '@/lib/validator';
import { requireAuth } from '@/lib/auth-helpers';
import { awardPoints, POINTS } from '@/lib/points';
import { sendReviewPushToFollowers } from '@/lib/push-notifications';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

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
        for (const entry of content) {
            await userSubmitReview(entry, user.id, eventId);
        }

        await awardPoints(user.id, 'review', POINTS.review, eventId);

        try {
            await sendReviewPushToFollowers(user.id, eventId);
        } catch (notificationError) {
            console.error('Failed to send follower review notifications:', notificationError);
        }

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

