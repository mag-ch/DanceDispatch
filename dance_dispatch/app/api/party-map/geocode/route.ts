import { NextResponse } from 'next/server';
import { getVenueCoordinatesBatch } from '@/lib/venue-geo';

// Caps request size so this endpoint can't be used to trigger unbounded geocoding work.
const MAX_VENUES_PER_REQUEST = 25;

export async function POST(request: Request) {
  try {
    const { venues } = await request.json();

    if (!Array.isArray(venues) || venues.length === 0) {
      return NextResponse.json({ coordinates: {} });
    }

    const normalizedVenues = venues
      .slice(0, MAX_VENUES_PER_REQUEST)
      .map((venue) => ({ id: String(venue?.id ?? '').trim(), address: String(venue?.address ?? '').trim() }))
      .filter((venue) => venue.id && venue.address);

    const coordinatesByVenueId = await getVenueCoordinatesBatch(normalizedVenues);
    const coordinates = Object.fromEntries(coordinatesByVenueId);

    return NextResponse.json({ coordinates });
  } catch (error) {
    console.error('Error geocoding party map venues:', error);
    return NextResponse.json({ error: 'Failed to geocode venues' }, { status: 500 });
  }
}
