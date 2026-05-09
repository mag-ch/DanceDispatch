import { requireAuth } from '@/lib/auth-helpers';
import { addHostsToEvent, getEventById, setHostsForEvent, updateEvent } from '@/lib/utils_supabase_server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const event = await getEventById(eventId);
        
        if (!event) {
            return new Response(JSON.stringify({ error: 'Event not found' }), {
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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const body = await request.json();
        if (Array.isArray(body?.hostIds)) {
            await requireAuth();
            const nextHostIds = await setHostsForEvent(eventId, body.hostIds);

            return new Response(JSON.stringify({ success: true, hostIds: nextHostIds }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (Array.isArray(body?.hostIdsToAdd)) {
            await requireAuth();
            const addedHostIds = await addHostsToEvent(eventId, body.hostIdsToAdd);

            return new Response(JSON.stringify({ success: true, hostIds: addedHostIds }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const updatedEvent = await updateEvent(eventId, body);
        
        if (!updatedEvent) {
            return new Response(JSON.stringify({ error: 'Event not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(updatedEvent), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update event';
        const normalizedMessage = message.toLowerCase();
        const status = normalizedMessage.includes('unauthorized')
            ? 401
            : normalizedMessage.includes('invalid')
                ? 400
                : 500;

        return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
