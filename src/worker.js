import { parseIncomingEmail } from './email-parser.js';
import {
  addDomains,
  clearInbox,
  createMailboxes,
  deleteDomain,
  deleteEmail,
  deleteMailbox,
  getAdminStats,
  getAttachmentWithOwner,
  getEmailDetail,
  getMailbox,
  getSettings,
  listAdminDomains,
  listAdminMailboxes,
  listAdminMessages,
  listInbox,
  listPublicDomains,
  normalizeEmailAddress,
  purgeExpiredEmails,
  saveIncomingEmail,
  updateDomain,
  updateMailbox,
  updateSettings,
} from './db.js';
import {
  createAdminToken,
  getAdminConfig,
  isAdminRequest,
  verifyAdminPin,
} from './auth.js';
import { buildSimulatedEmail } from './simulator.js';

const APP_VERSION = '2.0.0';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function errorJson(message, status = 400, code = 'BAD_REQUEST') {
  return json({ ok: false, error: message, code }, status);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeFilename(name) {
  return String(name || 'download')
    .replace(/[\r\n"\\]/g, '_')
    .slice(0, 140);
}

function isSimulatorAllowed(env) {
  return String(env?.ALLOW_SIMULATOR || '').toLowerCase() === 'true';
}

async function verifyPublicMailboxAccess(db, address) {
  const mailbox = await getMailbox(db, address);
  if (!mailbox) {
    return {
      ok: false,
      response: errorJson(
        `Alamat email ${address} belum terdaftar. Hanya Admin yang dapat membuat alamat email baru.`,
        404,
        'MAILBOX_NOT_FOUND'
      ),
    };
  }
  if (mailbox.status !== 'active') {
    return {
      ok: false,
      response: errorJson(
        `Alamat email ${address} sedang dinonaktifkan oleh Admin.`,
        403,
        'MAILBOX_DISABLED'
      ),
    };
  }
  return { ok: true, mailbox };
}

async function handleApi(request, env, url) {
  const { pathname, searchParams } = url;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (pathname === '/api/health' && method === 'GET') {
    return json({
      ok: true,
      app: env?.APP_NAME || 'AMC Mail',
      version: APP_VERSION,
      simulatorEnabled: isSimulatorAllowed(env),
      adminOnlyCreation: true,
      serverTime: Date.now(),
    });
  }

  if (pathname === '/api/domains' && method === 'GET') {
    const domains = await listPublicDomains(env.DB);
    const settings = await getSettings(env.DB);
    return json({
      ok: true,
      domains,
      defaultDomain: domains.find((d) => d.isDefault)?.domain || domains[0]?.domain || 'amc.web.id',
      retentionHours: settings.retentionHours,
      blockedUsernames: settings.blockedUsernames,
      adminOnlyCreation: true,
    });
  }

  if (pathname === '/api/inbox' && method === 'GET') {
    const addressRaw = searchParams.get('address') || '';
    const normalized = normalizeEmailAddress(addressRaw);
    if (!normalized) {
      return errorJson('Alamat email tidak valid. Gunakan format username@domain.', 400, 'INVALID_ADDRESS');
    }

    const isAdmin = await isAdminRequest(request, env);
    let mailbox = null;
    if (!isAdmin) {
      const access = await verifyPublicMailboxAccess(env.DB, normalized.address);
      if (!access.ok) return access.response;
      mailbox = access.mailbox;
    } else {
      mailbox = await getMailbox(env.DB, normalized.address);
    }

    const filter = searchParams.get('filter') || 'all';
    const q = searchParams.get('q') || '';
    const limit = Number(searchParams.get('limit') || 50);

    const data = await listInbox(env.DB, normalized.address, { filter, q, limit });
    return json({
      ok: true,
      address: normalized.address,
      domain: normalized.domain,
      localPart: normalized.localPart,
      mailboxRegistered: Boolean(mailbox),
      mailbox: mailbox ? { id: mailbox.id, label: mailbox.label, status: mailbox.status } : null,
      ...data,
    });
  }

  if (pathname === '/api/inbox' && method === 'DELETE') {
    const isAdmin = await isAdminRequest(request, env);
    if (!isAdmin) {
      return errorJson('Hanya Admin yang dapat menghapus isi kotak masuk.', 401, 'UNAUTHORIZED');
    }
    const addressRaw = searchParams.get('address') || '';
    const normalized = normalizeEmailAddress(addressRaw);
    if (!normalized) {
      return errorJson('Alamat email tidak valid.', 400, 'INVALID_ADDRESS');
    }
    const deleted = await clearInbox(env.DB, normalized.address);
    return json({ ok: true, deleted });
  }

  const rawEmailMatch = pathname.match(/^\/api\/emails\/([^/]+)\/raw$/);
  if (rawEmailMatch && method === 'GET') {
    const emailId = decodeURIComponent(rawEmailMatch[1]);
    const isAdmin = await isAdminRequest(request, env);
    let expectedRecipient = null;
    if (!isAdmin) {
      const normalized = normalizeEmailAddress(searchParams.get('address') || '');
      if (!normalized) return errorJson('Parameter address diperlukan.', 400);
      const access = await verifyPublicMailboxAccess(env.DB, normalized.address);
      if (!access.ok) return access.response;
      expectedRecipient = normalized.address;
    }

    const detail = await getEmailDetail(env.DB, emailId, { expectedRecipient, markRead: false });
    if (!detail) return errorJson('Pesan tidak ditemukan.', 404, 'NOT_FOUND');

    return new Response(detail.rawSource || '', {
      status: 200,
      headers: {
        'Content-Type': 'message/rfc822; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename(`amc-mail-${detail.id.slice(0, 8)}.eml`)}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const singleEmailMatch = pathname.match(/^\/api\/emails\/([^/]+)$/);
  if (singleEmailMatch) {
    const emailId = decodeURIComponent(singleEmailMatch[1]);
    const isAdmin = await isAdminRequest(request, env);
    let expectedRecipient = null;
    if (!isAdmin) {
      const normalized = normalizeEmailAddress(searchParams.get('address') || '');
      if (!normalized) return errorJson('Parameter address diperlukan.', 400);
      const access = await verifyPublicMailboxAccess(env.DB, normalized.address);
      if (!access.ok) return access.response;
      expectedRecipient = normalized.address;
    }

    if (method === 'GET') {
      const detail = await getEmailDetail(env.DB, emailId, { expectedRecipient, markRead: !isAdmin });
      if (!detail) return errorJson('Pesan tidak ditemukan.', 404, 'NOT_FOUND');
      return json({ ok: true, email: detail });
    }

    if (method === 'DELETE') {
      if (!isAdmin) {
        return errorJson('Hanya Admin yang dapat menghapus pesan.', 401, 'UNAUTHORIZED');
      }
      const deleted = await deleteEmail(env.DB, emailId, null);
      if (!deleted) return errorJson('Pesan tidak ditemukan.', 404, 'NOT_FOUND');
      return json({ ok: true, deleted: true });
    }
  }

  const attachmentMatch = pathname.match(/^\/api\/attachments\/([^/]+)$/);
  if (attachmentMatch && method === 'GET') {
    const attId = decodeURIComponent(attachmentMatch[1]);
    const isAdmin = await isAdminRequest(request, env);
    const att = await getAttachmentWithOwner(env.DB, attId);
    if (!att) return errorJson('Lampiran tidak ditemukan.', 404, 'NOT_FOUND');

    if (!isAdmin) {
      const normalized = normalizeEmailAddress(searchParams.get('address') || '');
      if (!normalized || normalized.address !== att.recipient) {
        return errorJson('Akses lampiran ditolak.', 403, 'FORBIDDEN');
      }
      const access = await verifyPublicMailboxAccess(env.DB, normalized.address);
      if (!access.ok) return access.response;
    }

    if (!att.content_base64) {
      return errorJson('Lampiran melebihi batas penyimpanan inline database.', 413, 'TOO_LARGE');
    }

    const bytes = base64ToUint8Array(att.content_base64);
    const mime = att.mime_type || 'application/octet-stream';
    const wantInline = searchParams.get('inline') === '1' && /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(mime);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `${wantInline ? 'inline' : 'attachment'}; filename="${safeFilename(att.filename)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  if (pathname === '/api/simulate' && method === 'POST') {
    const isAdmin = await isAdminRequest(request, env);
    if (!isAdmin) {
      return errorJson('Hanya Admin yang dapat mengirim email uji coba.', 403, 'SIMULATOR_DISABLED');
    }

    const body = await readJsonBody(request);
    if (!body) return errorJson('Body JSON tidak valid.', 400);

    const normalized = normalizeEmailAddress(body.recipient || body.address || '');
    if (!normalized) {
      return errorJson('Alamat penerima simulasi tidak valid.', 400, 'INVALID_ADDRESS');
    }

    const scenario = String(body.scenario || 'welcome');
    const sim = buildSimulatedEmail(scenario, normalized.address, {
      failedTarget: body.failedTarget,
      from: body.from,
      subject: body.subject,
      body: body.body,
    });

    const parsed = await parseIncomingEmail({
      raw: sim.raw,
      envelopeFrom: sim.envelopeFrom,
      envelopeTo: sim.envelopeTo,
    });
    const saved = await saveIncomingEmail(env.DB, parsed);
    if (!saved.saved) {
      return errorJson(`Simulasi ditolak: ${saved.reason}`, 422, saved.reason);
    }

    return json({
      ok: true,
      id: saved.id,
      recipient: parsed.recipient,
      messageType: parsed.messageType,
      isBounce: parsed.isBounce,
      otpCode: parsed.otpCode,
      bounceSummary: parsed.bounceInfo
        ? {
            category: parsed.bounceInfo.category,
            severity: parsed.bounceInfo.severity,
            smtpCode: parsed.bounceInfo.smtpCode,
            enhancedStatus: parsed.bounceInfo.enhancedStatus,
          }
        : null,
    }, 201);
  }

  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await readJsonBody(request);
    if (!body || !body.pin) {
      return errorJson('PIN Admin wajib diisi.', 400, 'PIN_REQUIRED');
    }

    const { valid, isDefaultPin } = await verifyAdminPin(body.pin, env);
    if (!valid) {
      return errorJson('PIN Admin salah. Periksa kembali PIN Anda.', 401, 'INVALID_PIN');
    }

    const { token, expiresAt } = await createAdminToken(env);
    return json({
      ok: true,
      token,
      expiresAt,
      isDefaultPin,
    });
  }

  if (pathname.startsWith('/api/admin/')) {
    const authorized = await isAdminRequest(request, env);
    if (!authorized) {
      return errorJson('Sesi Admin tidak valid atau kedaluwarsa. Silakan login kembali.', 401, 'UNAUTHORIZED');
    }

    if (pathname === '/api/admin/session' && method === 'GET') {
      const { isDefaultPin } = getAdminConfig(env);
      return json({ ok: true, authenticated: true, isDefaultPin });
    }

    if (pathname === '/api/admin/stats' && method === 'GET') {
      const stats = await getAdminStats(env.DB);
      const settings = await getSettings(env.DB);
      return json({ ok: true, stats, settings });
    }

    if (pathname === '/api/admin/messages' && method === 'GET') {
      const domain = searchParams.get('domain') || 'all';
      const type = searchParams.get('type') || 'all';
      const q = searchParams.get('q') || '';
      const limit = Number(searchParams.get('limit') || 50);
      const offset = Number(searchParams.get('offset') || 0);
      const data = await listAdminMessages(env.DB, { domain, type, q, limit, offset });
      return json({ ok: true, ...data });
    }

    const adminMsgMatch = pathname.match(/^\/api\/admin\/messages\/([^/]+)$/);
    if (adminMsgMatch && method === 'DELETE') {
      const emailId = decodeURIComponent(adminMsgMatch[1]);
      const deleted = await deleteEmail(env.DB, emailId, null);
      if (!deleted) return errorJson('Pesan tidak ditemukan.', 404, 'NOT_FOUND');
      return json({ ok: true, deleted: true });
    }

    if (pathname === '/api/admin/purge' && method === 'POST') {
      const body = (await readJsonBody(request)) || {};
      const olderThanHours =
        body.olderThanHours !== undefined && body.olderThanHours !== null && body.olderThanHours !== ''
          ? Number(body.olderThanHours)
          : null;
      const purged = await purgeExpiredEmails(env.DB, olderThanHours);
      return json({ ok: true, purged });
    }

    if (pathname === '/api/admin/mailboxes' && method === 'GET') {
      const domain = searchParams.get('domain') || 'all';
      const q = searchParams.get('q') || '';
      const mailboxes = await listAdminMailboxes(env.DB, { domain, q });
      return json({ ok: true, mailboxes });
    }

    if (pathname === '/api/admin/mailboxes' && method === 'POST') {
      const body = await readJsonBody(request);
      if (!body) return errorJson('Data alamat email tidak valid.', 400);

      let rawList = [];
      if (Array.isArray(body.addresses)) {
        rawList = body.addresses;
      } else if (typeof body.addresses === 'string') {
        rawList = body.addresses.split(/[\n,;]+/);
      } else if (typeof body.address === 'string') {
        rawList = [body.address];
      } else if (typeof body.localPart === 'string' && typeof body.domain === 'string') {
        rawList = [`${body.localPart.trim()}@${body.domain.trim()}`];
      }

      rawList = rawList.map((s) => String(s || '').trim()).filter(Boolean);
      if (rawList.length === 0) {
        return errorJson('Masukkan minimal satu username atau alamat email.', 400, 'EMPTY_ADDRESS');
      }

      const result = await createMailboxes(env.DB, rawList, {
        defaultDomain: body.defaultDomain || body.domain || '',
        label: body.label || '',
        status: body.status || 'active',
      });

      const mailboxes = await listAdminMailboxes(env.DB);
      return json({ ok: true, ...result, mailboxes }, result.added.length > 0 ? 201 : 200);
    }

    const adminMailboxMatch = pathname.match(/^\/api\/admin\/mailboxes\/(\d+)$/);
    if (adminMailboxMatch) {
      const mailboxId = Number(adminMailboxMatch[1]);
      if (method === 'PATCH') {
        const body = await readJsonBody(request);
        if (!body) return errorJson('Body JSON tidak valid.', 400);
        const updated = await updateMailbox(env.DB, mailboxId, body);
        if (!updated) return errorJson('Alamat email tidak ditemukan.', 404, 'NOT_FOUND');
        const mailboxes = await listAdminMailboxes(env.DB);
        return json({ ok: true, mailboxes });
      }
      if (method === 'DELETE') {
        const purgeMessages = searchParams.get('purge') === 'true';
        const deleted = await deleteMailbox(env.DB, mailboxId, { purgeMessages });
        if (!deleted) return errorJson('Alamat email tidak ditemukan.', 404, 'NOT_FOUND');
        const mailboxes = await listAdminMailboxes(env.DB);
        return json({ ok: true, deletedAddress: deleted.address, mailboxes });
      }
    }

    if (pathname === '/api/admin/domains' && method === 'GET') {
      const domains = await listAdminDomains(env.DB);
      return json({ ok: true, domains });
    }

    if (pathname === '/api/admin/domains' && method === 'POST') {
      const body = await readJsonBody(request);
      if (!body) return errorJson('Data domain tidak valid.', 400);

      let rawList = [];
      if (Array.isArray(body.domains)) {
        rawList = body.domains;
      } else if (typeof body.domains === 'string') {
        rawList = body.domains.split(/[\n,;]+/);
      } else if (typeof body.domain === 'string') {
        rawList = [body.domain];
      }

      if (rawList.length === 0) {
        return errorJson('Masukkan minimal satu nama domain.', 400, 'EMPTY_DOMAIN');
      }

      const result = await addDomains(env.DB, rawList, {
        status: body.status || 'active',
        notes: body.notes || '',
      });

      const domains = await listAdminDomains(env.DB);
      return json({ ok: true, ...result, domains }, result.added.length > 0 ? 201 : 200);
    }

    const adminDomainMatch = pathname.match(/^\/api\/admin\/domains\/(\d+)$/);
    if (adminDomainMatch) {
      const domainId = Number(adminDomainMatch[1]);
      if (method === 'PATCH') {
        const body = await readJsonBody(request);
        if (!body) return errorJson('Body JSON tidak valid.', 400);
        const updated = await updateDomain(env.DB, domainId, body);
        if (!updated) return errorJson('Domain tidak ditemukan.', 404, 'NOT_FOUND');
        const domains = await listAdminDomains(env.DB);
        return json({ ok: true, domains });
      }
      if (method === 'DELETE') {
        const deleted = await deleteDomain(env.DB, domainId);
        if (!deleted) return errorJson('Domain tidak ditemukan.', 404, 'NOT_FOUND');
        const domains = await listAdminDomains(env.DB);
        return json({ ok: true, deletedDomain: deleted.domain, domains });
      }
    }

    if (pathname === '/api/admin/settings' && method === 'GET') {
      const settings = await getSettings(env.DB);
      return json({ ok: true, settings });
    }

    if (pathname === '/api/admin/settings' && method === 'PATCH') {
      const body = await readJsonBody(request);
      if (!body) return errorJson('Body JSON tidak valid.', 400);
      const settings = await updateSettings(env.DB, body);
      return json({ ok: true, settings });
    }
  }

  return errorJson('Endpoint API tidak ditemukan.', 404, 'NOT_FOUND');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env, url);
      }
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
      return new Response('Static assets binding not configured', { status: 404 });
    } catch (err) {
      console.error('[AMC Mail fetch error]', err);
      if (url.pathname.startsWith('/api/')) {
        return errorJson(`Terjadi kesalahan server: ${err?.message || 'Unknown error'}`, 500, 'INTERNAL_ERROR');
      }
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Cloudflare Email Routing catch-all handler; accepts null-sender (<>) bounce reports.
  async email(message, env, ctx) {
    try {
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      const parsed = await parseIncomingEmail({
        raw: rawBuffer,
        envelopeFrom: message.from || '',
        envelopeTo: message.to || '',
      });

      const result = await saveIncomingEmail(env.DB, parsed);
      if (!result.saved && typeof message.setReject === 'function') {
        if (result.reason === 'domain_disabled') {
          message.setReject(`550 5.7.1 Domain ${parsed.domain} is currently disabled`);
        } else if (result.reason === 'domain_not_registered') {
          message.setReject(`550 5.1.1 Domain ${parsed.domain} is not configured on AMC Mail`);
        }
      }
    } catch (err) {
      console.error('[AMC Mail email() handler error]', err);
    }
  },

  async scheduled(event, env, ctx) {
    const purged = await purgeExpiredEmails(env.DB);
    console.log(`[AMC Mail cron] Purged ${purged} expired emails`);
  },
};
