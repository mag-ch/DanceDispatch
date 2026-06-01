import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { awardPoints, POINTS } from '@/lib/points';

/**
 * POST /api/referral
 * Body: { referrerId: string }
 * Called after a new user signs up via a referral link.
 * Awards 50 points to the referrer (idempotent — duplicate referrals are silently ignored).
 */
export async function POST(request: Request) {
  try {
    const newUser = await requireAuth();
    const body = await request.json();
    const referrerId = typeof body.referrerId === 'string' ? body.referrerId.trim() : '';

    if (!referrerId) {
      return NextResponse.json({ error: 'referrerId is required.' }, { status: 400 });
    }

    if (referrerId === newUser.id) {
      return NextResponse.json({ error: 'You cannot refer yourself.' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify the referrer exists
    const { data: referrerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', referrerId)
      .maybeSingle();

    if (profileError || !referrerProfile) {
      return NextResponse.json({ error: 'Referrer not found.' }, { status: 404 });
    }

    // Award the referrer — entity_id is the new user's id, unique constraint prevents double-awarding
    await awardPoints(referrerId, 'referral', POINTS.referral, newUser.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/referral:', error);
    const message = error instanceof Error ? error.message : 'Failed to process referral.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
