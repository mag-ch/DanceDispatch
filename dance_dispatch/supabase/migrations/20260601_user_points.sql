-- UserPoints table: tracks every points-earning action per user
CREATE TABLE IF NOT EXISTS "UserPoints" (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,   -- 'rsvp' | 'share' | 'review' | 'referral'
  points        INTEGER NOT NULL,
  entity_id     TEXT,            -- optional: event/host/venue id the action relates to
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON "UserPoints"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_action  ON "UserPoints"(action);

-- Prevent duplicate RSVP points for the same event
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_points_rsvp_unique
  ON "UserPoints"(user_id, action, entity_id)
  WHERE action = 'rsvp';

-- Prevent duplicate review points for the same event
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_points_review_unique
  ON "UserPoints"(user_id, action, entity_id)
  WHERE action = 'review';

-- Prevent duplicate referral points for the same referred user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_points_referral_unique
  ON "UserPoints"(user_id, action, entity_id)
  WHERE action = 'referral';

-- Row-level security
ALTER TABLE "UserPoints" ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own points
CREATE POLICY "users_read_own_points"
  ON "UserPoints" FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (used by API routes via server client) can insert/select all
CREATE POLICY "service_can_manage_points"
  ON "UserPoints" FOR ALL
  USING (true)
  WITH CHECK (true);
