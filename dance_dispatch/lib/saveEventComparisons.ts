'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { requireAuth } from './auth-helpers';

function getWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function saveEventComparison(
  eventAId: string,
  eventBId: string,
  winnerId: string
): Promise<{ success: boolean; comparisonId?: string; error?: string }> {

  const user = await requireAuth();

  const supabase = createServerClient();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const weekKey = getWeekKey();
  const aId = Math.min(Number(eventAId), Number(eventBId));
  const bId = Math.max(Number(eventAId), Number(eventBId));
  const winnerIsA = winnerId === String(aId);

  const { data: inserted, error: insertError } = await (await supabase)
    .from('event_comparisons')
    .insert({
      user_id: user.id,
      event_a_id: aId,
      event_b_id: bId,
      winner_is_a: winnerIsA,
      week_key: weekKey,
    })
    .select('id')
    .single();
    console.log('Inserted comparison:', inserted, 'Error:', insertError);
  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: 'You already compared these events' };
    }
    return { success: false, error: insertError.message };
  }

  revalidatePath('/');
  return { success: true, comparisonId: inserted?.id };
}


export async function updateEventComparison(
  comparisonId: string,
  winnerId: string,
  eventAId: string,
  eventBId: string
): Promise<{ success: boolean; error?: string }> {

  const user = await requireAuth();

  const supabase = createServerClient( );

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const winnerIsA = winnerId === eventAId;

  const { error } = await (await supabase)
    .from('event_comparisons')
    .update({ winner_is_a: winnerIsA })
    .eq('id', comparisonId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true };
}