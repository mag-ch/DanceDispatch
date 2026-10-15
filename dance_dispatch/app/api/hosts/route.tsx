import { getHosts , createHost} from '@/lib/utils_supabase_server';
import { requireAdmin } from '@/lib/admin';

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function splitTags(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeTag).filter(c => c.toLowerCase() !== "dj" && Boolean(c));
  }

  return value.split(',').map(normalizeTag).filter(c => c.toLowerCase() !== "dj" && Boolean(c));
}

function splitGenres(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : value.split(',');
  return Array.from(new Set(
    items.map((g) => g.replace(/[\[\]{}"']/g, '').trim().toLowerCase()).filter(Boolean)
  ));
}

// Exact genre match scores 1; one genre containing the other (e.g. "tech house" / "house") scores 0.5.
function genreSimilarity(source: string[], candidate: string[]): number {
  if (source.length === 0 || candidate.length === 0) return 0;
  let total = 0;
  for (const genre of source) {
    if (candidate.includes(genre)) {
      total += 1;
    } else if (candidate.some((other) => other.includes(genre) || genre.includes(other))) {
      total += 0.5;
    }
  }
  return total / Math.max(source.length, candidate.length);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tagsParam = searchParams.get('tags') ?? '';
    const genresParam = searchParams.get('genres') ?? '';
    const excludeParam = searchParams.get('exclude') ?? '';
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);

    const requestedTags = splitTags(tagsParam);
    const requestedGenres = splitGenres(genresParam);
    const excludeId = excludeParam.trim();

    let hosts = await getHosts();

    if (excludeId) {
      hosts = hosts.filter((host) => String(host.id) !== excludeId);
    }

    if (requestedGenres.length > 0) {
      // Similar-host mode: must share all tags, then rank by genre similarity.
      hosts = hosts
        .filter((host) => {
          const hostTags = splitTags(host.tags ?? '');
          return requestedTags.every((tag) => hostTags.includes(tag));
        })
        .map((host) => ({ host, score: genreSimilarity(requestedGenres, splitGenres(host.genres)) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.host.name.localeCompare(b.host.name))
        .map(({ host }) => host);
    } else if (requestedTags.length > 0) {
      hosts = hosts.filter((host) => {
        const hostTags = splitTags(host.tags ?? '');
        return requestedTags.some((tag) => hostTags.includes(tag));
      });
    }

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
    const { name, tags } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Host name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let normalizedTags = '';
    if (tags && typeof tags === 'string') {
      normalizedTags = '{' + (tags.split(',')).map(tag => `"${tag.trim()}"`).join(',') + '}';
    }

    const newHost = await createHost({
      name: name.trim(),
      tags: normalizedTags || null,
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