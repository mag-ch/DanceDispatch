import 'server-only';

type GeocodeResult = { lat: number; lng: number };

// Komoot's Photon geocoder (OpenStreetMap data), no API key required.
const PHOTON_GEOCODE_URL = 'https://photon.komoot.io/api/';

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    return null;
  }

  const url = `${PHOTON_GEOCODE_URL}?q=${encodeURIComponent(trimmedAddress)}&limit=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Photon returns GeoJSON: coordinates are [lng, lat].
    const coordinates = data?.features?.[0]?.geometry?.coordinates;

    if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
      return null;
    }

    return { lng: coordinates[0], lat: coordinates[1] };
  } catch (error) {
    console.error('Geocoding request failed:', error);
    return null;
  }
}
