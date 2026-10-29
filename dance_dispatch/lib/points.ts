import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export const POINTS = {
  rsvp: 10,
  share: 5,      // per recipient
  review: 20,
  referral: 50,
  submit_event: 50,
} as const;

export type PointsAction = keyof typeof POINTS;

/**
 * Awards points to a user for a given action.
 * Silently no-ops on unique-constraint violations (idempotent).
 *
 * @param userId   The user earning the points.
 * @param action   The action type.
 * @param points   Override the default point value (e.g. share scales by recipient count).
 * @param entityId Optional ID of the related entity (event id, referred user id, etc.).
 */
export async function awardPoints(
  userId: string,
  action: PointsAction,
  entityId?: string,
  client?: { from: SupabaseClient['from']; rpc: SupabaseClient['rpc'] },
): Promise<Error | null> {
  // Server routes must pass their cookie-aware client; the browser client has no session there.
  const supabase = client ?? createClient();
  const { error } = await supabase.from('UserPoints').insert({
    user_id: userId,
    action,
    points: POINTS[action],
    entity_id: entityId ?? null,
  });

  // Unique constraint violation means the user already earned these points — that's fine.
  if (error && error.code !== '23505') {
    console.error(`[awardPoints] Failed to award ${POINTS[action]} points (${action}) to ${userId}:`, error.message);
    return error;
  }

  const { error : rpcError } = await supabase.rpc("record_badge_activity", {
    p_user_id: userId,
    p_action_key: action,
    p_points_delta: POINTS[action],
    p_source_table: 'UserPoints', // The table where the points were recorded
    p_source_id: entityId ?? null,
    // One award per action per entity, so retries and re-approvals are safe
    p_dedupe_key: entityId ? `${action}:${userId}:${entityId}` : null,
  });
  if (rpcError) {
    console.error(`[awardPoints] Failed to record badge activity for ${userId}:`, rpcError);
    return rpcError;
  }
  return null;
}
