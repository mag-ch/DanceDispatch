import { getHosts } from '@/lib/utils_supabase_server';

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
