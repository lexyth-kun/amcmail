-- Initial Cloudflare D1 schema for AMC Mail (Al Muthi Creative).

CREATE TABLE IF NOT EXISTS domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled')),
  is_default INTEGER NOT NULL DEFAULT 0,
  mx_verified INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL,
  sender TEXT NOT NULL DEFAULT '<>',
  from_name TEXT NOT NULL DEFAULT '',
  from_address TEXT NOT NULL DEFAULT '',
  header_to TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '(Tanpa Subjek)',
  snippet TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'inbox' CHECK (message_type IN ('inbox', 'bounce', 'otp')),
  is_bounce INTEGER NOT NULL DEFAULT 0,
  bounce_info TEXT DEFAULT NULL,
  otp_code TEXT DEFAULT NULL,
  auth_results TEXT DEFAULT NULL,
  headers_json TEXT NOT NULL DEFAULT '[]',
  raw_source TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  is_read INTEGER NOT NULL DEFAULT 0,
  received_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_recipient_received ON emails(recipient, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_domain_received ON emails(domain, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_bounce_received ON emails(is_bounce, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_type_received ON emails(message_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_expires ON emails(expires_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_base64 TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO domains (domain, status, is_default, mx_verified, notes, created_at, updated_at) VALUES
  ('amc.web.id',            'active', 1, 0, 'Domain utama Al Muthi Creative',             strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('lexyth.my.id',          'active', 0, 0, 'Domain AMC, siap pasang Email Routing',      strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('rsykwnda.my.id',        'active', 0, 0, 'Domain AMC, siap pasang Email Routing',      strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('almuthicreative.my.id', 'active', 0, 0, 'Domain brand Al Muthi Creative',             strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('jelupang.web.id',       'active', 0, 0, 'Domain AMC, siap pasang Email Routing',      strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('cilpa.biz.id',          'active', 0, 0, 'Domain AMC, siap pasang Email Routing',      strftime('%s','now') * 1000, strftime('%s','now') * 1000);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('retention_hours',       '168',  strftime('%s','now') * 1000),
  ('auto_register_domains', 'true', strftime('%s','now') * 1000),
  ('blocked_usernames',     '',     strftime('%s','now') * 1000);
