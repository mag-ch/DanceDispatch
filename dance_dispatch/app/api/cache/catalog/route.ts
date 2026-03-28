import { revalidateCatalogCache } from '@/lib/utils_supabase_server';

export async function POST() {
  try {
    revalidateCatalogCache();
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Error revalidating catalog cache:', error);
    return Response.json({ ok: false, error: 'Failed to revalidate cache' }, { status: 500 });
  }
}
