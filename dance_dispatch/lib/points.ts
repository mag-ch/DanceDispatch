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
  points: number,
  entityId?: string,
): Promise<Error | null> {
  const supabase = await createClient();
  const { error } = await supabase.from('UserPoints').insert({
    user_id: userId,
    action,
    points,
    entity_id: entityId ?? null,
  });

  // Unique constraint violation means the user already earned these points — that's fine.
  if (error && error.code !== '23505') {
    console.error(`[awardPoints] Failed to award ${points} points (${action}) to ${userId}:`, error.message);
    return error;
  }

  const { error : rpcError } = await supabase.rpc("record_badge_activity", {
    p_user_id: userId,
    p_action_key: action,
    p_points_delta: points,
    p_source_table: 'UserPoints', // The table where the points were recorded
    p_source_id: entityId ?? null,
    // One award per action per entity, so retries and re-approvals are safe
    p_dedupe_key: entityId ? `${action}:${entityId}` : null,
  });
  if (rpcError) {
    console.error(`[awardPoints] Failed to record badge activity for ${userId}:`, rpcError);
    return rpcError;
  }
  return null;
}
