import { getEvents } from '@/lib/utils_supabase_server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get('venueId') ?? undefined;
        const hostId = searchParams.get('hostId') ?? undefined;
        const onlyUpcomingParam = searchParams.get('onlyUpcoming');
        const onlyUpcoming = onlyUpcomingParam === null ? true : onlyUpcomingParam !== 'false';

        const events = await getEvents(onlyUpcoming, venueId, hostId);

        return new Response(JSON.stringify(events), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error in GET /api/events:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
