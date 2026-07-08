import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getCachedEvents } from '@/lib/utils_supabase_server';
import { buildPartyPlanSummary, normalizePlanPrice, serializeEventIdsParam } from '@/lib/party-plan';
import { defaultPlanNameFromEvents, normalizeEventIds } from '@/lib/supabase/client';
import { getPlanFromId } from '@/lib/server_utils';


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {

    const { planId } = await params;
    

    const plan = await getPlanFromId(planId);

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Error in GET /api/user-plans:', error);
    const message = error instanceof Error ? error.message : 'Unable to load party plans.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {

    const { planId } = await params;

    const supabase = await createClient();

    const { data: deletedRows, error: deleteError } = await supabase
      .from('user_plans')
      .delete()
      .eq('id', Number(planId))
      .select('id')
      .limit(1);

    if (deleteError) {
      console.error('Failed deleting user party plan:', deleteError);
      return NextResponse.json({ error: 'Unable to delete party plan.' }, { status: 500 });
    }

    if (!deletedRows || deletedRows.length === 0) {
      return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/user-plans:', error);
    const message = error instanceof Error ? error.message : 'Unable to delete party plan.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}