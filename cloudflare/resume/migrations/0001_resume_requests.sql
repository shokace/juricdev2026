CREATE TABLE IF NOT EXISTS resume_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_key TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  requested_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'failed', 'unknown')),
  provider_id TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS resume_requests_email_time ON resume_requests(email_key, requested_at);
CREATE INDEX IF NOT EXISTS resume_requests_ip_time ON resume_requests(ip_hash, requested_at);
CREATE INDEX IF NOT EXISTS resume_requests_time ON resume_requests(requested_at);
