import { getHosts , createHost} from '@/lib/utils_supabase_server';
import { requireAdmin } from '@/lib/admin';
import { filterHostsByTypeAndGenres, normalizeHostType } from '@/lib/host-types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('host_type');
    const genresParam = searchParams.get('genres') ?? '';
    const excludeParam = searchParams.get('exclude') ?? '';
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);

    const requestedType = typeParam === null ? null : normalizeHostType(typeParam);
    if (typeParam !== null && !requestedType) {
      return new Response(JSON.stringify({ error: 'Invalid host type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const excludeId = excludeParam.trim();

    let hosts = await getHosts();

    if (excludeId) {
      hosts = hosts.filter((host) => String(host.id) !== excludeId);
    }

    hosts = filterHostsByTypeAndGenres(hosts, requestedType, genresParam);

    if (Number.isFinite(limitParam) && limitParam > 0) {
      hosts = hosts.slice(0, limitParam);
    }

    return new Response(JSON.stringify(hosts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in GET /api/hosts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch hosts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name, host_type, genres } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Host name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const hostType = host_type === undefined ? 'DJ' : normalizeHostType(host_type);
    if (!hostType) {
      return new Response(JSON.stringify({ error: 'Invalid host type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (genres !== undefined && (!Array.isArray(genres) || !genres.every((genre: unknown) => typeof genre === 'string'))) {
      return new Response(JSON.stringify({ error: 'Genres must be an array of strings' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const normalizedGenres = (genres ?? []).map((genre: string) => genre.trim()).filter(Boolean);

    const newHost = await createHost({
      name: name.trim(),
      host_type: hostType,
      genres: normalizedGenres,
    });

    return new Response(JSON.stringify(newHost), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in POST /api/hosts:', error);
    return new Response(JSON.stringify({ error: 'Failed to create host' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}