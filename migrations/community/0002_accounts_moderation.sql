ALTER TABLE community_users ADD COLUMN is_moderator INTEGER NOT NULL DEFAULT 0 CHECK (is_moderator IN (0,1));
ALTER TABLE community_users ADD COLUMN banned_at INTEGER;
ALTER TABLE community_reports ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
ALTER TABLE community_comments ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
ALTER TABLE community_comments ADD COLUMN moderation_note TEXT CHECK (moderation_note IS NULL OR length(moderation_note) <= 1000);

CREATE TABLE community_moderation_audit (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES community_users(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('post','comment')),
  target_id TEXT NOT NULL, old_status TEXT NOT NULL, new_status TEXT NOT NULL,
  note TEXT CHECK(note IS NULL OR length(note) <= 1000), created_at INTEGER NOT NULL
);
CREATE INDEX community_moderation_audit_recent ON community_moderation_audit(created_at DESC);
CREATE TABLE community_rate_limits (
  user_id TEXT NOT NULL REFERENCES community_users(id), action TEXT NOT NULL,
  window_started INTEGER NOT NULL, count INTEGER NOT NULL CHECK(count >= 0),
  PRIMARY KEY(user_id,action)
);
