import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const user = await requireAuth();
    const { userId } = await params;
    if (!UUID.test(userId) || userId.toLowerCase() === user.id.toLowerCase()) {
      return NextResponse.json({ error: 'Choose another valid user.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from('UserFollowUsers')
      .delete()
      .eq('followed_id', user.id)
      .eq('user_id', userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove follower:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: 'Failed to remove follower.' }, { status });
  }
}
