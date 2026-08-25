import 'server-only';

type GeocodeResult = { lat: number; lng: number };

// Komoot's Photon geocoder (OpenStreetMap data), no API key required.
const PHOTON_GEOCODE_URL = 'https://photon.komoot.io/api/';
// Keep this well under Next's request timeout so a slow/unreachable geocoder can't hang the page.
const GEOCODE_TIMEOUT_MS = 5000;

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    return null;
  }

  const url = `${PHOTON_GEOCODE_URL}?q=${encodeURIComponent(trimmedAddress)}&limit=1`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: abortController.signal });
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
    console.error('Geocoding request failed:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

