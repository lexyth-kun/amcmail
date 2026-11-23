const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL_PART_REGEX = /^[a-z0-9][a-z0-9._+-]{0,62}$/;

export function normalizeDomain(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '');
}

export function isValidDomain(domain) {
  return DOMAIN_REGEX.test(domain) && domain.length <= 253;
}

export function normalizeEmailAddress(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  const atIdx = clean.lastIndexOf('@');
  if (atIdx <= 0) return null;
  const localPart = clean.slice(0, atIdx);
  const domain = normalizeDomain(clean.slice(atIdx + 1));
  if (!LOCAL_PART_REGEX.test(localPart) || !isValidDomain(domain)) return null;
  return { address: `${localPart}@${domain}`, localPart, domain };
}

function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const map = {
    retention_hours: '168',
    auto_register_domains: 'true',
    blocked_usernames: '',
  };
  for (const row of results || []) {
    map[row.key] = row.value;
  }
  return {
    retentionHours: Math.max(1, Math.min(8760, Number(map.retention_hours) || 168)),
    autoRegisterDomains: map.auto_register_domains !== 'false',
    blockedUsernames: String(map.blocked_usernames || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    blockedUsernamesRaw: String(map.blocked_usernames || ''),
  };
}

export async function updateSettings(db, patch) {
  const now = Date.now();
  const stmts = [];
  if (patch.retentionHours !== undefined) {
    const hrs = Math.max(1, Math.min(8760, Math.round(Number(patch.retentionHours) || 168)));
    stmts.push(
      db
        .prepare(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        )
        .bind('retention_hours', String(hrs), now)
    );
  }
  if (patch.autoRegisterDomains !== undefined) {
    stmts.push(
      db
        .prepare(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        )
        .bind('auto_register_domains', patch.autoRegisterDomains ? 'true' : 'false', now)
    );
  }
  if (patch.blockedUsernames !== undefined) {
    const cleaned = String(patch.blockedUsernames || '')
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .join(',');
    stmts.push(
      db
        .prepare(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
        )
        .bind('blocked_usernames', cleaned, now)
    );
  }
  if (stmts.length > 0) {
    await db.batch(stmts);
  }
  return getSettings(db);
}

export async function listPublicDomains(db) {
  const { results } = await db
    .prepare(
      `SELECT id, domain, is_default, mx_verified
       FROM domains
       WHERE status = 'active'
       ORDER BY is_default DESC, domain ASC`
    )
    .all();
  return (results || []).map((r) => ({
    id: r.id,
    domain: r.domain,
    isDefault: Boolean(r.is_default),
    mxVerified: Boolean(r.mx_verified),
  }));
}

export async function listAdminDomains(db) {
  const { results } = await db
    .prepare(
      `SELECT
         d.id,
         d.domain,
         d.status,
         d.is_default,
         d.mx_verified,
         d.notes,
         d.created_at,
         d.updated_at,
         COUNT(e.id) AS total_emails,
         COALESCE(SUM(CASE WHEN e.is_bounce = 1 THEN 1 ELSE 0 END), 0) AS bounce_emails,
         MAX(e.received_at) AS last_received_at
       FROM domains d
       LEFT JOIN emails e ON e.domain = d.domain
       GROUP BY d.id
       ORDER BY
         CASE d.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
         d.is_default DESC,
         d.domain ASC`
    )
    .all();

  return (results || []).map((r) => ({
    id: r.id,
    domain: r.domain,
    status: r.status,
    isDefault: Boolean(r.is_default),
    mxVerified: Boolean(r.mx_verified),
    notes: r.notes || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    totalEmails: Number(r.total_emails || 0),
    bounceEmails: Number(r.bounce_emails || 0),
    lastReceivedAt: r.last_received_at || null,
  }));
}

export async function addDomains(db, rawList, { status = 'active', notes = '' } = {}) {
  const validStatus = ['active', 'pending', 'disabled'].includes(status) ? status : 'active';
  const now = Date.now();
  const added = [];
  const skipped = [];
  const invalid = [];

  const uniqueDomains = [...new Set(rawList.map(normalizeDomain).filter(Boolean))];

  for (const domain of uniqueDomains) {
    if (!isValidDomain(domain)) {
      invalid.push(domain);
      continue;
    }
    const existing = await db.prepare('SELECT id FROM domains WHERE domain = ?').bind(domain).first();
    if (existing) {
      skipped.push(domain);
      continue;
    }
    await db
      .prepare(
        `INSERT INTO domains (domain, status, is_default, mx_verified, notes, created_at, updated_at)
         VALUES (?, ?, 0, 0, ?, ?, ?)`
      )
      .bind(domain, validStatus, String(notes || '').slice(0, 300), now, now)
      .run();
    added.push(domain);
  }

  return { added, skipped, invalid };
}

export async function updateDomain(db, id, patch) {
  const existing = await db.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first();
  if (!existing) return null;

  const now = Date.now();
  const nextStatus = ['active', 'pending', 'disabled'].includes(patch.status) ? patch.status : existing.status;
  const nextNotes = patch.notes !== undefined ? String(patch.notes || '').slice(0, 300) : existing.notes;
  const nextMx = patch.mxVerified !== undefined ? (patch.mxVerified ? 1 : 0) : existing.mx_verified;

  const stmts = [];
  let nextDefault = existing.is_default;
  if (patch.isDefault === true) {
    stmts.push(db.prepare('UPDATE domains SET is_default = 0'));
    nextDefault = 1;
  } else if (patch.isDefault === false) {
    nextDefault = 0;
  }

  stmts.push(
    db
      .prepare(
        `UPDATE domains
         SET status = ?, is_default = ?, mx_verified = ?, notes = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(nextStatus, nextDefault, nextMx, nextNotes, now, id)
  );

  await db.batch(stmts);
  return db.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first();
}

export async function deleteDomain(db, id) {
  const existing = await db.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first();
  if (!existing) return null;
  await db.prepare('DELETE FROM domains WHERE id = ?').bind(id).run();
  return existing;
}

export async function saveIncomingEmail(db, parsed) {
  const settings = await getSettings(db);
  const now = parsed.receivedAt || Date.now();
  const expiresAt = now + settings.retentionHours * 60 * 60 * 1000;

  if (!parsed.domain || !parsed.recipient) {
    throw new Error('Recipient email address is invalid or missing');
  }

  const domainRow = await db.prepare('SELECT id, status FROM domains WHERE domain = ?').bind(parsed.domain).first();
  if (!domainRow) {
    if (settings.autoRegisterDomains && isValidDomain(parsed.domain)) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO domains (domain, status, is_default, mx_verified, notes, created_at, updated_at)
           VALUES (?, 'active', 0, 1, 'Otomatis terdaftar dari email masuk', ?, ?)`
        )
        .bind(parsed.domain, now, now)
        .run();
    } else {
      return { saved: false, reason: 'domain_not_registered' };
    }
  } else if (domainRow.status === 'disabled') {
    return { saved: false, reason: 'domain_disabled' };
  } else if (domainRow.status === 'pending') {
    // Promote pending domains to active on first verified delivery.
    await db
      .prepare('UPDATE domains SET status = ?, mx_verified = 1, updated_at = ? WHERE id = ?')
      .bind('active', now, domainRow.id)
      .run();
  } else {
    await db
      .prepare('UPDATE domains SET mx_verified = 1 WHERE id = ? AND mx_verified = 0')
      .bind(domainRow.id)
      .run();
  }

  const stmts = [
    db
      .prepare(
        `INSERT INTO emails (
          id, recipient, local_part, domain, sender, from_name, from_address, header_to,
          subject, snippet, text_body, html_body, message_type, is_bounce, bounce_info,
          otp_code, auth_results, headers_json, raw_source, size_bytes, has_attachments,
          is_read, received_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        parsed.id,
        parsed.recipient,
        parsed.localPart,
        parsed.domain,
        parsed.sender,
        parsed.fromName,
        parsed.fromAddress,
        parsed.headerTo,
        parsed.subject,
        parsed.snippet,
        parsed.textBody,
        parsed.htmlBody,
        parsed.messageType,
        parsed.isBounce ? 1 : 0,
        parsed.bounceInfo ? JSON.stringify(parsed.bounceInfo) : null,
        parsed.otpCode || null,
        parsed.authResults ? JSON.stringify(parsed.authResults) : null,
        JSON.stringify(parsed.headers || []),
        parsed.rawSource || '',
        parsed.sizeBytes || 0,
        (parsed.attachments || []).length > 0 ? 1 : 0,
        now,
        expiresAt
      ),
  ];

  for (const att of parsed.attachments || []) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO attachments (id, email_id, filename, mime_type, size_bytes, content_base64, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(att.id, parsed.id, att.filename, att.mimeType, att.sizeBytes, att.contentBase64, now)
    );
  }

  await db.batch(stmts);
  return { saved: true, id: parsed.id };
}

function serializeListRow(r) {
  const bounceInfo = safeJsonParse(r.bounce_info, null);
  return {
    id: r.id,
    recipient: r.recipient,
    domain: r.domain,
    sender: r.sender,
    fromName: r.from_name,
    fromAddress: r.from_address,
    subject: r.subject,
    snippet: r.snippet,
    messageType: r.message_type,
    isBounce: Boolean(r.is_bounce),
    bounceSummary: bounceInfo
      ? {
          category: bounceInfo.category,
          severity: bounceInfo.severity,
          label: bounceInfo.label,
          smtpCode: bounceInfo.smtpCode,
          enhancedStatus: bounceInfo.enhancedStatus,
          finalRecipient: bounceInfo.finalRecipient,
        }
      : null,
    otpCode: r.otp_code || null,
    hasAttachments: Boolean(r.has_attachments),
    isRead: Boolean(r.is_read),
    sizeBytes: Number(r.size_bytes || 0),
    receivedAt: r.received_at,
    expiresAt: r.expires_at,
  };
}

export async function listInbox(db, recipient, { filter = 'all', q = '', limit = 50 } = {}) {
  const now = Date.now();
  const conditions = ['recipient = ?', 'expires_at > ?'];
  const params = [recipient, now];

  if (filter === 'bounce') {
    conditions.push('is_bounce = 1');
  } else if (filter === 'otp') {
    conditions.push("message_type = 'otp'");
  } else if (filter === 'inbox') {
    conditions.push('is_bounce = 0');
  }

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conditions.push('(subject LIKE ? OR sender LIKE ? OR from_name LIKE ? OR from_address LIKE ? OR snippet LIKE ?)');
    params.push(like, like, like, like, like);
  }

  const clampedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  params.push(clampedLimit);

  const { results } = await db
    .prepare(
      `SELECT id, recipient, domain, sender, from_name, from_address, subject, snippet,
              message_type, is_bounce, bounce_info, otp_code, has_attachments, is_read,
              size_bytes, received_at, expires_at
       FROM emails
       WHERE ${conditions.join(' AND ')}
       ORDER BY received_at DESC
       LIMIT ?`
    )
    .bind(...params)
    .all();

  const counts = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN is_bounce = 1 THEN 1 ELSE 0 END), 0) AS bounce,
         COALESCE(SUM(CASE WHEN message_type = 'otp' THEN 1 ELSE 0 END), 0) AS otp,
         COALESCE(SUM(CASE WHEN is_bounce = 0 THEN 1 ELSE 0 END), 0) AS inbox,
         COALESCE(SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END), 0) AS unread
       FROM emails
       WHERE recipient = ? AND expires_at > ?`
    )
    .bind(recipient, now)
    .first();

  return {
    messages: (results || []).map(serializeListRow),
    counts: {
      all: Number(counts?.total || 0),
      inbox: Number(counts?.inbox || 0),
      bounce: Number(counts?.bounce || 0),
      otp: Number(counts?.otp || 0),
      unread: Number(counts?.unread || 0),
    },
  };
}

export async function getEmailDetail(db, id, { expectedRecipient = null, markRead = true } = {}) {
  const row = await db.prepare('SELECT * FROM emails WHERE id = ?').bind(id).first();
  if (!row) return null;
  if (expectedRecipient && row.recipient !== expectedRecipient) {
    return null;
  }

  if (markRead && !row.is_read) {
    await db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').bind(id).run();
    row.is_read = 1;
  }

  const { results: attRows } = await db
    .prepare('SELECT id, filename, mime_type, size_bytes, (content_base64 IS NOT NULL) AS downloadable FROM attachments WHERE email_id = ?')
    .bind(id)
    .all();

  return {
    id: row.id,
    recipient: row.recipient,
    localPart: row.local_part,
    domain: row.domain,
    sender: row.sender,
    fromName: row.from_name,
    fromAddress: row.from_address,
    headerTo: row.header_to,
    subject: row.subject,
    snippet: row.snippet,
    textBody: row.text_body,
    htmlBody: row.html_body,
    messageType: row.message_type,
    isBounce: Boolean(row.is_bounce),
    bounceInfo: safeJsonParse(row.bounce_info, null),
    otpCode: row.otp_code || null,
    authResults: safeJsonParse(row.auth_results, null),
    headers: safeJsonParse(row.headers_json, []),
    rawSource: row.raw_source,
    sizeBytes: Number(row.size_bytes || 0),
    isRead: Boolean(row.is_read),
    receivedAt: row.received_at,
    expiresAt: row.expires_at,
    attachments: (attRows || []).map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mime_type,
      sizeBytes: Number(a.size_bytes || 0),
      downloadable: Boolean(a.downloadable),
    })),
  };
}

export async function getAttachmentWithOwner(db, attachmentId) {
  return db
    .prepare(
      `SELECT a.id, a.email_id, a.filename, a.mime_type, a.size_bytes, a.content_base64, e.recipient
       FROM attachments a
       JOIN emails e ON e.id = a.email_id
       WHERE a.id = ?`
    )
    .bind(attachmentId)
    .first();
}

// Delete linked attachment rows explicitly so cleanup holds even if foreign keys are disabled.
export async function deleteEmail(db, id, expectedRecipient = null) {
  if (expectedRecipient) {
    const exists = await db
      .prepare('SELECT id FROM emails WHERE id = ? AND recipient = ?')
      .bind(id, expectedRecipient)
      .first();
    if (!exists) return false;
    await db.batch([
      db.prepare('DELETE FROM attachments WHERE email_id = ?').bind(id),
      db.prepare('DELETE FROM emails WHERE id = ? AND recipient = ?').bind(id, expectedRecipient),
    ]);
    return true;
  }
  const exists = await db.prepare('SELECT id FROM emails WHERE id = ?').bind(id).first();
  if (!exists) return false;
  await db.batch([
    db.prepare('DELETE FROM attachments WHERE email_id = ?').bind(id),
    db.prepare('DELETE FROM emails WHERE id = ?').bind(id),
  ]);
  return true;
}

export async function clearInbox(db, recipient) {
  await db
    .prepare('DELETE FROM attachments WHERE email_id IN (SELECT id FROM emails WHERE recipient = ?)')
    .bind(recipient)
    .run();
  const res = await db.prepare('DELETE FROM emails WHERE recipient = ?').bind(recipient).run();
  return Number(res.meta?.changes || 0);
}

export async function listAdminMessages(db, { domain = '', type = 'all', q = '', limit = 50, offset = 0 } = {}) {
  const conditions = ['1 = 1'];
  const params = [];

  if (domain && domain !== 'all') {
    conditions.push('domain = ?');
    params.push(normalizeDomain(domain));
  }
  if (type === 'bounce') {
    conditions.push('is_bounce = 1');
  } else if (type === 'otp') {
    conditions.push("message_type = 'otp'");
  } else if (type === 'inbox') {
    conditions.push('is_bounce = 0');
  }
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conditions.push(
      '(recipient LIKE ? OR subject LIKE ? OR sender LIKE ? OR from_address LIKE ? OR snippet LIKE ? OR bounce_info LIKE ?)'
    );
    params.push(like, like, like, like, like, like);
  }

  const clampedLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const clampedOffset = Math.max(0, Number(offset) || 0);

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM emails WHERE ${conditions.join(' AND ')}`)
    .bind(...params)
    .first();

  const { results } = await db
    .prepare(
      `SELECT id, recipient, domain, sender, from_name, from_address, subject, snippet,
              message_type, is_bounce, bounce_info, otp_code, has_attachments, is_read,
              size_bytes, received_at, expires_at
       FROM emails
       WHERE ${conditions.join(' AND ')}
       ORDER BY received_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...params, clampedLimit, clampedOffset)
    .all();

  return {
    total: Number(countRow?.total || 0),
    messages: (results || []).map(serializeListRow),
  };
}

export async function getAdminStats(db) {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;

  const [emailStats, domainStats] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS total_emails,
           COALESCE(SUM(CASE WHEN is_bounce = 1 THEN 1 ELSE 0 END), 0) AS total_bounces,
           COALESCE(SUM(CASE WHEN message_type = 'otp' THEN 1 ELSE 0 END), 0) AS total_otps,
           COALESCE(SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END), 0) AS emails_24h,
           COALESCE(SUM(CASE WHEN is_bounce = 1 AND received_at >= ? THEN 1 ELSE 0 END), 0) AS bounces_24h,
           COUNT(DISTINCT recipient) AS unique_mailboxes
         FROM emails`
      )
      .bind(last24h, last24h)
      .first(),
    db
      .prepare(
        `SELECT
           COUNT(*) AS total_domains,
           COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_domains,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_domains,
           COALESCE(SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END), 0) AS disabled_domains
         FROM domains`
      )
      .first(),
  ]);

  return {
    totalEmails: Number(emailStats?.total_emails || 0),
    totalBounces: Number(emailStats?.total_bounces || 0),
    totalOtps: Number(emailStats?.total_otps || 0),
    emails24h: Number(emailStats?.emails_24h || 0),
    bounces24h: Number(emailStats?.bounces_24h || 0),
    uniqueMailboxes: Number(emailStats?.unique_mailboxes || 0),
    totalDomains: Number(domainStats?.total_domains || 0),
    activeDomains: Number(domainStats?.active_domains || 0),
    pendingDomains: Number(domainStats?.pending_domains || 0),
    disabledDomains: Number(domainStats?.disabled_domains || 0),
  };
}

export async function purgeExpiredEmails(db, olderThanHours = null) {
  const now = Date.now();
  let res;
  if (olderThanHours !== null && olderThanHours >= 0) {
    const cutoff = now - olderThanHours * 60 * 60 * 1000;
    await db
      .prepare('DELETE FROM attachments WHERE email_id IN (SELECT id FROM emails WHERE received_at < ?)')
      .bind(cutoff)
      .run();
    res = await db.prepare('DELETE FROM emails WHERE received_at < ?').bind(cutoff).run();
  } else {
    await db
      .prepare('DELETE FROM attachments WHERE email_id IN (SELECT id FROM emails WHERE expires_at <= ?)')
      .bind(now)
      .run();
    res = await db.prepare('DELETE FROM emails WHERE expires_at <= ?').bind(now).run();
  }
  return Number(res.meta?.changes || 0);
}
