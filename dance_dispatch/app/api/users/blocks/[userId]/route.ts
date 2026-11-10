import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ userId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function updateBlock(context: Context, block: boolean) {
  try {
    const user = await requireAuth();
    const { userId } = await context.params;
    if (!UUID.test(userId) || userId.toLowerCase() === user.id.toLowerCase()) {
      return NextResponse.json({ error: 'Choose another valid user.' }, { status: 400 });
    }

    const supabase = await createClient();
    const result = block
      ? await supabase.from('user_blocks').upsert(
        { blocker_id: user.id, blocked_id: userId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      )
      : await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
    if (result.error) throw result.error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update block:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ error: 'Failed to update block.' }, { status });
  }
}

export async function POST(_request: Request, context: Context) {
  return updateBlock(context, true);
}

export async function DELETE(_request: Request, context: Context) {
  return updateBlock(context, false);
}
