-- ============================================================
-- Badge: Century Reviewer (100 reviews)
-- Run this against your Supabase project via the SQL Editor
-- or push it as a migration via the Supabase CLI.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Insert the badge definition
--    ON CONFLICT means it is safe to re-run.
-- ────────────────────────────────────────────────────────────
INSERT INTO public.badges (code, name, icon, tier, sort_order, is_active)
VALUES ('century_reviewer', 'Century Reviewer', '📝', 'gold', 50, true)
ON CONFLICT (code) DO UPDATE
  SET name       = EXCLUDED.name,
      icon       = EXCLUDED.icon,
      tier       = EXCLUDED.tier,
      sort_order = EXCLUDED.sort_order,
      is_active  = EXCLUDED.is_active;

-- ────────────────────────────────────────────────────────────
-- 1b. Insert the requirement only if the badge still exists.
--     This skips manually deleted badge rows safely.
-- ────────────────────────────────────────────────────────────
WITH requirement_spec AS (
  SELECT
    'century_reviewer'::text AS code,
    'reviews_count'::text AS requirement_type,
    NULL::text AS action_key,
    100::int AS min_value
)
INSERT INTO public.badge_requirements (badge_id, requirement_type, action_key, min_value)
SELECT
  b.id,
  s.requirement_type,
  s.action_key,
  s.min_value
FROM requirement_spec s
JOIN public.badges b
  ON b.code = s.code
WHERE EXISTS (
  SELECT 1
  FROM public.badges existing
  WHERE existing.id = b.id
)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. Helper: award the badge if the user has >= 100 reviews.
--    SECURITY DEFINER so it can write to user_badges even when
--    called from a restricted role.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_review_milestone_badge(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_id bigint;
  v_count    bigint;
BEGIN
  -- Count review-action rows in UserPoints for this user.
  -- Each row represents one distinct rewarded review (duplicates are
  -- deduplicated upstream via the unique constraint on UserPoints).
  SELECT COUNT(*)
  INTO   v_count
  FROM   public."UserPoints"
  WHERE  user_id = p_user_id
    AND  action  = 'review';

  IF v_count < 100 THEN
    RETURN;
  END IF;

  SELECT id
  INTO   v_badge_id
  FROM   public.badges
  WHERE  code      = 'century_reviewer'
    AND  is_active = true;

  IF v_badge_id IS NULL THEN
    RETURN;  -- badge deactivated or not yet seeded
  END IF;

  -- Idempotent: silently skip if already awarded.
  INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
  VALUES (p_user_id, v_badge_id, now())
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. Patch record_badge_activity to call the helper.
--
--    Add this block inside your existing record_badge_activity
--    function body, after the deduplication / early-exit logic:
--
--      IF p_action_key = 'review' THEN
--        PERFORM public.award_review_milestone_badge(p_user_id);
--      END IF;
--
--    Example showing where it fits (adjust to match your actual
--    function body — do not replace blindly):
--
-- CREATE OR REPLACE FUNCTION public.record_badge_activity(
--   p_user_id      uuid,
--   p_action_key   text,
--   p_points_delta integer,
--   p_source_table text,
--   p_source_id    text,
--   p_metadata     jsonb,
--   p_dedupe_key   text
-- ) RETURNS void ...
-- AS $$
-- BEGIN
--   -- … your existing deduplication / activity log insert …
--
--   -- Badge checks — add one IF block per badge type:
--   IF p_action_key = 'review' THEN
--     PERFORM public.award_review_milestone_badge(p_user_id);
--   END IF;
-- END;
-- $$;
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 4. Backfill: award the badge to users who already have
--    >= 100 reviews (safe to run once after deploying).
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT user_id
    FROM   public."UserPoints"
    WHERE  action = 'review'
    GROUP  BY user_id
    HAVING COUNT(*) >= 100
  LOOP
    PERFORM public.award_review_milestone_badge(rec.user_id);
  END LOOP;
END;
$$;
