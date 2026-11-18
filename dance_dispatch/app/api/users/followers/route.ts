import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createClient();
    const { data: follows, error } = await supabase
      .from('UserFollowUsers')
      .select('user_id')
      .eq('followed_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = [...new Set((follows ?? []).map((follow) => String(follow.user_id)))];
    if (ids.length === 0) return NextResponse.json({ users: [] });
    const [{ data: profiles, error: profileError }, { data: following, error: followingError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', ids),
      supabase
        .from('UserFollowUsers')
        .select('followed_id')
        .eq('user_id', user.id)
        .in('followed_id', ids),
    ]);
    if (profileError) throw profileError;
    if (followingError) throw followingError;
    const names = new Map((profiles ?? []).map((profile) => [
      String(profile.id),
      profile.username || profile.full_name || 'User',
    ]));
    const followingIds = new Set((following ?? []).map((follow) => String(follow.followed_id)));
    return NextResponse.json({
      users: ids.map((id) => ({
        id,
        name: names.get(id) ?? 'Unavailable user',
        isFollowing: followingIds.has(id),
      })),
    });
  } catch (error) {
    console.error('Failed to load followers:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: 'Failed to load followers.' }, { status });
  }
}
