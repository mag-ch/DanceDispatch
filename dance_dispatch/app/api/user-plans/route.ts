import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { getCachedEvents } from '@/lib/utils_supabase_server';
import { buildPartyPlanSummary, normalizePlanPrice, serializeEventIdsParam } from '@/lib/party-plan';
import { defaultPlanNameFromEvents, normalizeEventIds, normalizePlanId } from '@/lib/supabase/client';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('user_plans')
      .select('id, plan_name, event_ids')
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed loading user plans:', error);
      return NextResponse.json({ error: 'Unable to load party plans.' }, { status: 500 });
    }

    const allEvents = await getCachedEvents(false);
    const eventById = new Map(
      allEvents.map((event: any) => [Number(event.id), event]),
    );

    const plans = (rows ?? []).map((row: any, index: number) => {
      const eventIds = normalizeEventIds(row?.event_ids);
      const events = eventIds
        .map((eventId) => eventById.get(eventId))
        .filter((event): event is any => Boolean(event))
        .map((event: any) => ({
          id: event.id,
          title: event.title,
          startdate: event.startdate,
          starttime: event.starttime,
          location: event.location,
          price: normalizePlanPrice(event.price),
        }));

      const summary = buildPartyPlanSummary(events);
      const planKey = serializeEventIdsParam(eventIds);
      const planName = String(row?.plan_name ?? '').trim() || defaultPlanNameFromEvents(events);

      return {
        id: Number(row?.id ?? index + 1),
        name: planName,
        planKey,
        eventIds,
        events,
        summary,
      };
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Error in GET /api/user-plans:', error);
    const message = error instanceof Error ? error.message : 'Unable to load party plans.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const payload = await request.json().catch(() => ({}));

    const eventIds = normalizeEventIds(payload?.eventIds);
    const rawPlanName = String(payload?.planName ?? '').trim();

    if (eventIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one valid event id.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: validEvents, error: validEventsError } = await supabase
      .from('Events')
      .select('id, start')
      .in('id', eventIds);

    if (validEventsError) {
      console.error('Failed validating party plan events:', validEventsError);
      return NextResponse.json({ error: 'Unable to validate selected events.' }, { status: 500 });
    }

    const validatedIds = [...new Set((validEvents ?? []).map((row: any) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0))];

    if (validatedIds.length === 0) {
      return NextResponse.json({ error: 'No valid events found for this plan.' }, { status: 400 });
    }

    const orderedEventRows = eventIds
      .map((eventId) => (validEvents ?? []).find((row: any) => Number(row.id) === eventId))
      .filter((row): row is any => Boolean(row));
    const planName = rawPlanName || defaultPlanNameFromEvents(orderedEventRows);

    const { data: insertedRows, error: insertError } = await supabase
      .from('user_plans')
      .insert({
        user_id: user.id,
        plan_name: planName,
        event_ids: validatedIds,
      })
      .select('id')
      .limit(1);

    if (insertError) {
      console.error('Failed saving user party plan:', insertError);
      return NextResponse.json({ error: 'Unable to save party plan.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, planId: Number(insertedRows?.[0]?.id ?? 0), planName, eventIds: validatedIds });
  } catch (error) {
    console.error('Error in POST /api/user-plans:', error);
    const message = error instanceof Error ? error.message : 'Unable to save party plan.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const payload = await request.json().catch(() => ({}));

    const planId = normalizePlanId(payload?.planId);
    const eventIds = normalizeEventIds(payload?.eventIds);
    const rawPlanName = String(payload?.planName ?? '').trim();

    if (!planId || eventIds.length === 0) {
      return NextResponse.json({ error: 'Both planId and eventIds are required.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: validEvents, error: validEventsError } = await supabase
      .from('Events')
      .select('id, start')
      .in('id', eventIds);

    if (validEventsError) {
      console.error('Failed validating edited plan events:', validEventsError);
      return NextResponse.json({ error: 'Unable to validate selected events.' }, { status: 500 });
    }

    const validatedIds = [...new Set((validEvents ?? []).map((row: any) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0))];
    if (validatedIds.length === 0) {
      return NextResponse.json({ error: 'No valid events found for this plan.' }, { status: 400 });
    }

    const orderedEventRows = eventIds
      .map((eventId) => (validEvents ?? []).find((row: any) => Number(row.id) === eventId))
      .filter((row): row is any => Boolean(row));
    const planName = rawPlanName || defaultPlanNameFromEvents(orderedEventRows);

    const { data: updatedRows, error: updateError } = await supabase
      .from('user_plans')
      .update({ plan_name: planName, event_ids: validatedIds })
      .eq('id', Number(planId))
      .eq('user_id', user.id)
      .select('id, plan_name, event_ids')
      .limit(1);

    if (updateError) {
      console.error('Failed updating user party plan:', updateError);
      return NextResponse.json({ error: 'Unable to update party plan.' }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, planId: Number(updatedRows[0].id), planName, eventIds: validatedIds });
  } catch (error) {
    console.error('Error in PATCH /api/user-plans:', error);
    const message = error instanceof Error ? error.message : 'Unable to update party plan.';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const payload = await request.json().catch(() => ({}));
    const planId = normalizePlanId(payload?.planId);

    if (!planId) {
      return NextResponse.json({ error: 'planId is required.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: deletedRows, error: deleteError } = await supabase
      .from('user_plans')
      .delete()
      .eq('id', Number(planId))
      .eq('user_id', user.id)
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
