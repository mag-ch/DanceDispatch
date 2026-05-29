import { getHosts , createHost} from '@/lib/utils_supabase_server';

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function splitTags(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeTag).filter(c => c.toLowerCase() !== "dj" && Boolean(c));
  }

  return value.split(',').map(normalizeTag).filter(c => c.toLowerCase() !== "dj" && Boolean(c));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tagsParam = searchParams.get('tags') ?? '';
    const excludeParam = searchParams.get('exclude') ?? '';

    const requestedTags = splitTags(tagsParam);
    const excludeId = excludeParam.trim();

    let hosts = await getHosts();

    if (excludeId) {
      hosts = hosts.filter((host) => String(host.id) !== excludeId);
    }

    if (requestedTags.length > 0) {
      hosts = hosts.filter((host) => {
        const hostTags = splitTags(host.tags ?? '');
        return requestedTags.some((tag) => tag.toLowerCase() !== "dj" && hostTags.includes(tag));
      });
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