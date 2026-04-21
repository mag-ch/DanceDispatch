import { getEvents, submitEvent } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';

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

export async function POST(request: Request) {
    try {
        await requireAuth();

        const body = await request.json();
        const {
            title,
            startdate,
            starttime,
            endtime,
            locationid,
            newVenueName,
            newVenueAddress,
            description,
            price,
            imageurl,
            externallink,
        } = body;

        if (!title || !startdate || !starttime || !endtime) {
            return new Response(JSON.stringify({ error: 'title, startdate, starttime and endtime are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const result = await submitEvent({
            title,
            startdate,
            starttime,
            endtime,
            locationid,
            newVenueName,
            newVenueAddress,
            description,
            price,
            imageurl,
            externallink,
        });

        if ('duplicate' in result) {
            return new Response(JSON.stringify({ duplicate: true, id: result.id }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ id: result.id }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit event';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
