import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const rawQuery = String(searchParams.get('query') ?? '').trim();

    if (rawQuery.length < 2) {
      return NextResponse.json([]);
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id,username,full_name')
      .ilike('username', `%${rawQuery}%`)
      .neq('id', user.id)
      .limit(8);

    if (error) {
      console.error('Error searching share recipients:', error);
      return NextResponse.json({ error: 'Unable to search users.' }, { status: 500 });
    }

    const results = (data ?? [])
      .map((profile: any) => ({
        id: String(profile.id ?? '').trim(),
        username: String(profile.username ?? '').trim(),
        full_name: typeof profile.full_name === 'string' ? profile.full_name : null,
      }))
      .filter((profile) => profile.id && profile.username);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in GET /api/share/users:', error);
    const message = error instanceof Error ? error.message : 'Unable to search users.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}