import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { sendReviewReplyNotification } from '@/lib/push-notifications';

// POST /api/review-replies - create a reply/comment on a review (or on another reply),
// then notify the parent reply's author (or the review owner for a top-level reply).
export async function POST(request: Request) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const reviewId = Number(body?.reviewId);
        const parentReplyId = body?.parentReplyId != null ? Number(body.parentReplyId) : null;
        const comment = String(body?.comment ?? '').trim();

        if (!reviewId || !comment) {
            return NextResponse.json({ error: 'reviewId and comment are required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: inserted, error: insertError } = await supabase
            .from('review_replies')
            .insert({
                review_id: reviewId,
                parent_reply_id: parentReplyId,
                user_id: user.id,
                comment,
            })
            .select('id, review_id, parent_reply_id, user_id, comment, created_at')
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        try {
            await sendReviewReplyNotification({
                replierUserId: user.id,
                reviewId: String(reviewId),
                parentReplyId: parentReplyId ? String(parentReplyId) : null,
                comment,
            });
        } catch (notificationError) {
            console.error('Failed to send review reply notification:', notificationError);
        }

        return NextResponse.json({ ok: true, reply: inserted }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to post reply';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
