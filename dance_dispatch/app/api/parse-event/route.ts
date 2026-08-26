import { getCachedHosts, getCachedVenues } from "@/lib/utils_supabase_server";
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('eventId') ?? '').trim();

    if (!id) {
      return Response.json({ error: 'Missing eventId' }, { status: 400 });
    }
    const res = await fetch(
      `https://api.parse.bot/scraper/b89b7fc2-7fcb-49f4-8b0d-8ba592c967cc/get_event_detail?event_id=${id}`,
      {
        method: 'GET',
        headers: { 'X-API-Key': process.env.PARSE_BOT ?? '' },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error('parse.bot error:', res.status, errText);
      return Response.json(
        { error: `Upstream API returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()).data;

    console.log('Raw event data:', data);
    const { date: startdate, time: starttime } = splitDateTime(data.start_time);
    const { date: enddate, time: endtime } = splitDateTime(data.end_time);

    const [venues, hosts] = await Promise.all([
      getCachedVenues(),
      getCachedHosts(),
    ]);
    const hostByName = new Map(hosts.map((host: any) => [String(host.name), host]));

    let venueId: string | null = null;
    let newVenueName = '';
    let newVenueAddress = '';

    if (data.venue && data.venue.name) {
      const matchedVenues = venues.filter(
        (venue: any) => normalize(venue.name) === normalize(data.venue.name)
      );

      if (matchedVenues.length === 1) {
        venueId = matchedVenues[0].id;
      } else if (matchedVenues.length > 1 && data.venue.address) {
        const venue = matchedVenues.find((venue: any) =>
          matchPostalCode(venue.address, data.venue.address)
        );
        if (venue) venueId = venue.id;
      }

      if (!venueId) {
        newVenueName = data.venue.name;
        newVenueAddress = data.venue.address ?? '';
      }
    }

    return Response.json(
      {
        title: data.title ?? '',
        description: data.description ?? '',
        startdate,
        starttime,
        enddate,
        endtime,
        locationid: venueId,
        newVenueName,
        newVenueAddress,
        price: data.cost !== undefined && data.cost !== '' ? String(data.cost) : '',
        imageurl: data.flyer_url ?? '',
        externallink: data.content_url ?? '',
        hostids: data.artists
          ?.map((artist: any) => hostByName.get(artist.name)?.id)
          .filter(Boolean) ?? [],
        hostnames: data.artists?.map((artist: any) => artist.name).filter(Boolean) ?? [],
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('parse-event failed:', err);
    return Response.json(
      { error: 'Scrape failed', details: err.message },
      { status: 500 }
    );
  }
}

function splitDateTime(isoString: string | undefined): { date: string; time: string } {
  if (!isoString) return { date: '', time: '' };

  const [datePart, timePart] = isoString.split('T');
  const time = timePart ? timePart.replace(/\.\d+$/, '') : ''; // strip milliseconds

  return { date: datePart ?? '', time };
}
function normalize(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, ' ');
}
function matchPostalCode(addressA: string, addressB: string): boolean {
  const postalA = addressA.match(/\b\d{4,5}\b/)?.[0];
  const postalB = addressB.match(/\b\d{4,5}\b/)?.[0];
  return Boolean(postalA && postalB && postalA === postalB);
}