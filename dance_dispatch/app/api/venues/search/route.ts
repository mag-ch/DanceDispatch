import { searchVenuesByAttributes, type VenueAttributeFilter } from '@/lib/server_utils';

function parseFilters(raw: unknown): VenueAttributeFilter[] {
    if (!Array.isArray(raw)) return [];

    return raw.filter((filter): filter is VenueAttributeFilter => {
        if (!filter || typeof filter !== 'object') return false;
        if (typeof (filter as any).attribute !== 'string') return false;

        if ((filter as any).type === 'unique') {
            return Array.isArray((filter as any).values) && (filter as any).values.every((v: unknown) => typeof v === 'string');
        }

        if ((filter as any).type === 'rating') {
            return typeof (filter as any).min === 'number' || typeof (filter as any).max === 'number';
        }

        return false;
    });
}

// GET /api/venues/search?filters=[{"attribute":"floor_material","type":"unique","values":["hardwood"]},{"attribute":"sound_quality","type":"rating","min":4}]
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawFilters = searchParams.get('filters');

    try {
        const filters = rawFilters ? parseFilters(JSON.parse(rawFilters)) : [];
        const venues = await searchVenuesByAttributes(filters);
        return Response.json(venues);
    } catch (error) {
        console.error('Error searching venues by attributes:', error);
        return Response.json({ error: 'Failed to search venues' }, { status: 500 });
    }
}

// POST /api/venues/search  { "filters": [{ "attribute": "floor_material", "type": "unique", "values": ["hardwood", "concrete"] }] }
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const filters = parseFilters(body?.filters);
        const venues = await searchVenuesByAttributes(filters);
        return Response.json(venues);
    } catch (error) {
        console.error('Error searching venues by attributes:', error);
        return Response.json({ error: 'Failed to search venues' }, { status: 500 });
    }
}
