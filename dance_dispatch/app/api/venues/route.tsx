import { getVenues } from "@/lib/utils";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const exclude = searchParams.get('exclude');

    try {
        // Replace with your actual database query
        const venues = await getVenues();
        const filteredVenues = venues.filter(v => {
            if (type && v.type !== type) return false;
            if (exclude && v.id === exclude) return false;
            return true;
        });
        // const venues = await db.venue.findMany({
        //     where: {
        //         type: type || undefined,
        //         id: exclude ? { not: exclude } : undefined,
        //     },
        // });

        return Response.json(filteredVenues);
    } catch (error) {
        return Response.json({ error: 'Failed to fetch venues' }, { status: 500 });
    }
}