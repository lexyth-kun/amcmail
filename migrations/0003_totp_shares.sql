CREATE TABLE IF NOT EXISTS totp_shares (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  secret_b32 TEXT NOT NULL,
  digits INTEGER NOT NULL DEFAULT 6,
  period INTEGER NOT NULL DEFAULT 30,
  algorithm TEXT NOT NULL DEFAULT 'SHA-1',
  revoke_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_totp_shares_expires ON totp_shares (expires_at);
