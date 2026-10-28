PRAGMA foreign_keys = ON;

CREATE TABLE community_users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT CHECK (display_name IS NULL OR length(display_name) <= 80),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE community_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES community_users(id),
  route_id TEXT NOT NULL CHECK (length(route_id) BETWEEN 1 AND 128),
  category TEXT NOT NULL CHECK (category IN ('fare', 'detour', 'frequency', 'tip', 'route')),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES community_users(id),
  moderation_note TEXT CHECK (moderation_note IS NULL OR length(moderation_note) <= 1000),
  CHECK (status != 'approved' OR reviewed_at IS NOT NULL)
);

CREATE INDEX community_reports_public_feed
  ON community_reports(status, created_at DESC, id DESC);
CREATE INDEX community_reports_route_status
  ON community_reports(route_id, status, created_at DESC);
CREATE INDEX community_reports_user_recent
  ON community_reports(user_id, created_at DESC);

CREATE TABLE community_comments (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES community_reports(id),
  user_id TEXT NOT NULL REFERENCES community_users(id),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  reviewed_at INTEGER,
  reviewed_by TEXT REFERENCES community_users(id),
  CHECK (status != 'approved' OR reviewed_at IS NOT NULL)
);
CREATE INDEX community_comments_report_status
  ON community_comments(report_id, status, created_at, id);
CREATE INDEX community_comments_user_recent
  ON community_comments(user_id, created_at DESC);

CREATE TABLE community_votes (
  report_id TEXT NOT NULL REFERENCES community_reports(id),
  user_id TEXT NOT NULL REFERENCES community_users(id),
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (report_id, user_id)
);
CREATE INDEX community_votes_user_recent
  ON community_votes(user_id, created_at DESC);
