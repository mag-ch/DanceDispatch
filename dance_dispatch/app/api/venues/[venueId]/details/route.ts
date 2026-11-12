import { getAggregatedVenueAttributes, getUniqueVenueAttributes, getVenueAttributes, getVenueComments } from '@/lib/server_utils';
import { geocodeAddress } from '@/lib/geocoding';
import { getCachedEvents, getCachedVenues } from '@/lib/utils_supabase_server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await params;
    const [venues, allEvents, uniqueVenueAttributes, aggregatedVenueAttributes, venueAttributes, venueComments] = await Promise.all([
      getCachedVenues(),
      getCachedEvents(false, venueId),
      getUniqueVenueAttributes(venueId),
      getAggregatedVenueAttributes(venueId),
      getVenueAttributes(venueId),
      getVenueComments(venueId),
    ]);

    const venue = venues.find((item) => item.id === venueId);
    if (!venue) return Response.json({ error: 'Venue not found' }, { status: 404 });

    const venueCoordinates = venue.address ? await geocodeAddress(venue.address) : null;
    return Response.json({
      venue,
      venues,
      allEvents,
      uniqueVenueAttributes,
      aggregatedVenueAttributes,
      venueAttributes,
      venueComments,
      venueCoordinates,
    });
  } catch (error) {
    console.error('Error fetching venue details:', error);
    return Response.json({ error: 'Failed to fetch venue details' }, { status: 500 });
  }
}
