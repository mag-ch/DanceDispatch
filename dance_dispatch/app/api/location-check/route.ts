import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { confirmUserLocationForActiveEvents } from '@/lib/location-confirmation';

export async function POST(request: Request) {
  try {
    const { latitude, longitude } = await request.json();

    if (
      typeof latitude !== 'number'
      || typeof longitude !== 'number'
      || Number.isNaN(latitude)
      || Number.isNaN(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
    ) {
      return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    }

    const user = await requireAuth();
    const confirmations = await confirmUserLocationForActiveEvents(user.id, latitude, longitude);

    return NextResponse.json({ confirmations });
  } catch (error) {
    console.error('Error checking in location:', error);
    const status = error instanceof Error && error.message.startsWith('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: 'Failed to check location' }, { status });
  }
}
