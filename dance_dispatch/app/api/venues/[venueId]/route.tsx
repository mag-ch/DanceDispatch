import { getVenues } from '@/lib/utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        const { venueId } = await params;
        const venues = await getVenues();
        const venue = venues.find(v => v.id === venueId);        
        if (!venue) {
            return new Response(JSON.stringify({ error: 'Venue not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(venue), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch venue' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}