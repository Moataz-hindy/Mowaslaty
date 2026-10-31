-- New table only. Do not reapply the existing community migrations.
-- No raw IPs, email addresses, coordinates, or feedback bodies are stored here.
CREATE TABLE IF NOT EXISTS service_rate_limits (
  key TEXT PRIMARY KEY,
  window_started INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS service_rate_limits_expiry ON service_rate_limits(expires_at);
