import { userSubmitReview } from '@/lib/utils';
import { validateAndSanitizeReviews } from '@/lib/validator';
import { requireAuth } from '@/lib/auth-helpers';

export async function POST(
    request: Request,
    { params }: { params: { eventId: string } }
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

        for (const entry of content) {
            await userSubmitReview(entry, user.id, eventId);
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

