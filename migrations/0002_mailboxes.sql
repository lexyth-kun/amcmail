CREATE TABLE IF NOT EXISTS mailboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_domain ON mailboxes (domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailboxes_status ON mailboxes (status, created_at DESC);
