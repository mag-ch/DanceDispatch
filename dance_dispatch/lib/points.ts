import { createClient } from '@/lib/supabase/server';

export const POINTS = {
  rsvp: 10,
  share: 5,      // per recipient
  review: 20,
  referral: 50,
} as const;

export type PointsAction = keyof typeof POINTS;

async function recordBadgeActivitySafe(params: {
  userId: string;
  action: PointsAction;
  pointsDelta: number;
  entityId?: string;
  reason: string;
  dedupeKeyPrefix: 'points' | 'attempt';
}) {
  const supabase = await createClient();
  const dedupeKey = [
    params.dedupeKeyPrefix,
    params.userId,
    params.action,
    params.entityId ?? 'none',
    String(params.pointsDelta),
  ].join(':');

  const { error } = await supabase.rpc('record_badge_activity', {
    p_user_id: params.userId,
    p_action_key: params.action,
    p_points_delta: params.pointsDelta,
    p_source_table: 'UserPoints',
    p_source_id: params.entityId ?? null,
    p_metadata: {
      reason: params.reason,
      action: params.action,
      entityId: params.entityId ?? null,
      points: params.pointsDelta,
    },
    p_dedupe_key: dedupeKey,
  });

  if (error && error.code !== '23505') {
    console.error(
      `[awardPoints] Failed to record badge activity for ${params.userId} (${params.action}):`,
      error.message,
    );
  }
}

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
): Promise<void> {
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
    return;
  }

  if (error?.code === '23505') {
    await recordBadgeActivitySafe({
      userId,
      action,
      pointsDelta: 0,
      entityId,
      reason: 'awardPointsDuplicate',
      dedupeKeyPrefix: 'attempt',
    });
    return;
  }

  await recordBadgeActivitySafe({
    userId,
    action,
    pointsDelta: points,
    entityId,
    reason: 'awardPoints',
    dedupeKeyPrefix: 'points',
  });
}
