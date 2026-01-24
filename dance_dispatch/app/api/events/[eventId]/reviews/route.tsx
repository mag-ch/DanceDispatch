import { getEventReviews } from '@/lib/utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const event = await getEventReviews(eventId);
        
        if (!event) {
            return new Response(JSON.stringify({ error: `Reviews for ${eventId} not found` }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(event), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch event' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
