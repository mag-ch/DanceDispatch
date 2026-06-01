import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leaderboard?limit=50
 * Returns the top users ranked by total points.
 * Response shape: { leaderboard: Array<{ rank, userId, username, avatarUrl, totalPoints, breakdown }> }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100);

    const supabase = await createClient();

    // Aggregate total points per user from UserPoints
    const { data: pointsRows, error: pointsError } = await supabase
      .from('UserPoints')
      .select('user_id, points, action');

    if (pointsError) {
      console.error('[leaderboard] Error fetching points:', pointsError);
      return NextResponse.json({ error: 'Failed to load leaderboard.' }, { status: 500 });
    }

    // Aggregate client-side (avoids raw SQL requirement)
    type Breakdown = Record<string, number>;
    const totals: Record<string, { total: number; breakdown: Breakdown }> = {};
    for (const row of pointsRows ?? []) {
      if (!totals[row.user_id]) {
        totals[row.user_id] = { total: 0, breakdown: {} };
      }
      totals[row.user_id].total += row.points;
      totals[row.user_id].breakdown[row.action] =
        (totals[row.user_id].breakdown[row.action] ?? 0) + row.points;
    }

    const sorted = Object.entries(totals)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, limit);

    if (sorted.length === 0) {
      return NextResponse.json({ leaderboard: [] });
    }

    const userIds = sorted.map(([id]) => id);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, profile_picture')
      .in('id', userIds);

    if (profilesError) {
      console.error('[leaderboard] Error fetching profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to load user profiles.' }, { status: 500 });
    }

    const profileMap: Record<string, { username: string; profile_picture: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.id] = { username: p.username, profile_picture: p.profile_picture };
    }

    const leaderboard = sorted.map(([userId, { total, breakdown }], index) => ({
      rank: index + 1,
      userId,
      username: profileMap[userId]?.username ?? 'Unknown',
      avatarUrl: profileMap[userId]?.profile_picture ?? null,
      totalPoints: total,
      breakdown,
    }));

    return NextResponse.json(
      { leaderboard },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[leaderboard] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to load leaderboard.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
