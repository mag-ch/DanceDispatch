import { getEvents, updateEvent } from '@/lib/utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params;
        const events = await getEvents();
        const event = events.find(e => e.id === eventId);        
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
        console.log(`PATCH request received for event id ${eventId}`);
        const body = await request.json();
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
        return new Response(JSON.stringify({ error: 'Failed to update event' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
