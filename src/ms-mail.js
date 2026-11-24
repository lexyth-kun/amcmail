import { extractOtpCode } from './email-parser.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ANYWHERE_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL_REGEX = /^[^\s@:|;]+@[^\s@:|;]+\.[^\s@:|;]+$/;
const EMAIL_ANYWHERE_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export const DEMO_MS_CLIENT_ID = '00000000-0000-4000-8000-000000000001';

const STANDARD_FOLDERS = [
  { id: 'all_incoming', displayName: 'Semua Masuk (Inbox + Junk)', wellKnown: true },
  { id: 'inbox', displayName: 'Inbox', wellKnown: true },
  { id: 'junkemail', displayName: 'Junk Email (Spam)', wellKnown: true },
  { id: 'sentitems', displayName: 'Sent Items', wellKnown: true },
  { id: 'drafts', displayName: 'Drafts', wellKnown: true },
  { id: 'deleteditems', displayName: 'Deleted Items', wellKnown: true },
];

export function parseMicrosoftCombo(rawCombo = '', explicit = {}) {
  const directClientId = String(explicit.clientId || '').trim();
  const directRefresh = String(explicit.refreshToken || '').trim();
  const directEmail = String(explicit.email || '').trim().toLowerCase();

  if (directClientId && directRefresh) {
    if (!UUID_REGEX.test(directClientId)) {
      return { valid: false, error: 'Format Client ID tidak valid (harus berupa UUID aplikasi Microsoft).' };
    }
    if (directRefresh.length < 24) {
      return { valid: false, error: 'Refresh Token terlalu pendek atau tidak lengkap.' };
    }
    return {
      valid: true,
      email: EMAIL_REGEX.test(directEmail) ? directEmail : '',
      refreshToken: directRefresh,
      clientId: directClientId.toLowerCase(),
    };
  }

  const line = String(rawCombo || '')
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean) || '';

  if (!line) {
    return {
      valid: false,
      error: 'Tempel combo Microsoft dalam format email|password|refresh_token|client_id atau email:password:refresh_token:client_id.',
    };
  }

  let tokens = [];
  if (line.includes('|')) {
    tokens = line.split('|');
  } else if (line.includes('----')) {
    tokens = line.split('----');
  } else if (line.includes('\t')) {
    tokens = line.split('\t');
  } else if (line.includes(';')) {
    tokens = line.split(';');
  } else if (line.includes(':')) {
    tokens = line.split(':');
  } else {
    tokens = line.split(/\s+/);
  }

  tokens = tokens.map((t) => t.trim()).filter(Boolean);

  let email = '';
  let clientId = '';
  const remaining = [];

  for (const tok of tokens) {
    if (!clientId && UUID_REGEX.test(tok)) {
      clientId = tok.toLowerCase();
      continue;
    }
    if (!email && EMAIL_REGEX.test(tok)) {
      email = tok.toLowerCase();
      continue;
    }
    remaining.push(tok);
  }

  if (!clientId) {
    const m = line.match(UUID_ANYWHERE_REGEX);
    if (m) clientId = m[0].toLowerCase();
  }
  if (!email) {
    const m = line.match(EMAIL_ANYWHERE_REGEX);
    if (m) email = m[0].toLowerCase();
  }

  let refreshToken = '';
  const tokenCandidates = remaining
    .filter((t) => t.toLowerCase() !== clientId && t.toLowerCase() !== email)
    .sort((a, b) => {
      const score = (s) => {
        let pts = s.length;
        if (/^(?:M\.|0\.|1\.|OAQ|Ew)/i.test(s)) pts += 500;
        return pts;
      };
      return score(b) - score(a);
    });

  if (tokenCandidates.length > 0 && tokenCandidates[0].length >= 24) {
    refreshToken = tokenCandidates[0];
  }

  if (!clientId) {
    return {
      valid: false,
      error: 'Client ID (UUID) tidak ditemukan pada combo. Pastikan format menyertakan client_id Microsoft.',
    };
  }
  if (!refreshToken) {
    return {
      valid: false,
      error: 'Refresh Token tidak terdeteksi. Pastikan Anda menempelkan refresh_token OAuth Microsoft, bukan hanya password.',
    };
  }

  return {
    valid: true,
    email,
    refreshToken,
    clientId,
  };
}

function stripHtmlSimple(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateMicrosoftTokenError(errJson, status) {
  const code = String(errJson?.error || '').toLowerCase();
  const desc = String(errJson?.error_description || '');
  if (code === 'invalid_grant' || desc.includes('AADSTS70000') || desc.includes('AADSTS70008')) {
    return 'Refresh Token ditolak Microsoft (kedaluwarsa, dicabut, atau tidak cocok dengan Client ID tersebut).';
  }
  if (code === 'unauthorized_client' || desc.includes('AADSTS700016') || desc.includes('AADSTS50020')) {
    return 'Client ID tidak diizinkan untuk akun Microsoft ini atau belum mendukung public client OAuth.';
  }
  if (code === 'invalid_client' || desc.includes('AADSTS7000218')) {
    return 'Aplikasi Client ID ini memerlukan client_secret (bukan aplikasi Public Client / Native).';
  }
  if (code === 'invalid_scope' || desc.includes('AADSTS70011')) {
    return 'Token tidak memiliki izin Microsoft Graph Mail.Read untuk membaca kotak masuk.';
  }
  return `Gagal menukar token Microsoft (HTTP ${status}): ${code || 'OAuth error'}`;
}

export async function refreshMicrosoftAccessToken({ refreshToken, clientId, fetchImpl = fetch }) {
  const attempts = [
    {
      url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scope: 'https://graph.microsoft.com/.default offline_access',
    },
    {
      url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scope: '',
    },
    {
      url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      scope: '',
    },
  ];

  let lastError = 'Gagal menghubungkan ke server OAuth Microsoft.';
  let lastStatus = 401;
  let fallbackToken = null;

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (attempt.scope) {
      params.set('scope', attempt.scope);
    }

    const res = await fetchImpl(attempt.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) {
      const grantedScope = String(data.scope || '');
      const tokenResult = {
        ok: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: Number(data.expires_in || 3600),
        scope: grantedScope,
      };
      if (!grantedScope || /mail\.read|mail\.readwrite/i.test(grantedScope)) {
        return tokenResult;
      }
      if (!fallbackToken) {
        fallbackToken = tokenResult;
      }
      continue;
    }

    lastStatus = res.status || 400;
    lastError = translateMicrosoftTokenError(data, lastStatus);
    const errCode = String(data?.error || '').toLowerCase();
    if (errCode === 'invalid_client') {
      break;
    }
  }

  if (fallbackToken) {
    return fallbackToken;
  }

  return {
    ok: false,
    status: lastStatus >= 400 && lastStatus < 500 ? 401 : 502,
    error: lastError,
  };
}

function normalizeGraphMessageSummary(item, folderTag = '') {
  const fromObj = item?.from?.emailAddress || item?.sender?.emailAddress || {};
  const fromName = String(fromObj.name || '').trim();
  const fromAddress = String(fromObj.address || '').trim();
  const toFirst = item?.toRecipients?.[0]?.emailAddress?.address || '';
  const subject = String(item?.subject || '(Tanpa Subjek)');
  const snippet = String(item?.bodyPreview || '').trim();
  const receivedAt = item?.receivedDateTime ? Date.parse(item.receivedDateTime) || Date.now() : Date.now();
  const otpCode = extractOtpCode(subject, snippet, '', false);

  return {
    id: String(item.id || ''),
    subject,
    snippet,
    fromName: fromName || fromAddress || 'Microsoft Sender',
    fromAddress,
    sender: fromAddress || fromName || 'unknown',
    recipient: toFirst,
    receivedAt,
    isRead: Boolean(item.isRead),
    hasAttachments: Boolean(item.hasAttachments),
    otpCode: otpCode || null,
    folderTag: folderTag || '',
  };
}

async function graphGet(path, accessToken, fetchImpl = fetch) {
  const url = path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function fetchFolderMessages(accessToken, folderId, top = 30, fetchImpl = fetch) {
  const select = 'id,subject,bodyPreview,from,sender,toRecipients,receivedDateTime,isRead,hasAttachments';
  const safeFolder = encodeURIComponent(folderId);
  const query = `/me/mailFolders/${safeFolder}/messages?$top=${Math.min(50, Math.max(5, top))}&$orderby=receivedDateTime%20desc&$select=${select}`;
  return graphGet(query, accessToken, fetchImpl);
}

function buildMockMicrosoftData(emailHint = 'demo.outlook@hotmail.com') {
  const addr = emailHint || 'demo.outlook@hotmail.com';
  const now = Date.now();
  const folders = [
    { id: 'all_incoming', displayName: 'Semua Masuk (Inbox + Junk)', totalItemCount: 3, unreadItemCount: 2 },
    { id: 'inbox', displayName: 'Inbox', totalItemCount: 2, unreadItemCount: 1 },
    { id: 'junkemail', displayName: 'Junk Email (Spam)', totalItemCount: 1, unreadItemCount: 1 },
    { id: 'sentitems', displayName: 'Sent Items', totalItemCount: 0, unreadItemCount: 0 },
    { id: 'deleteditems', displayName: 'Deleted Items', totalItemCount: 0, unreadItemCount: 0 },
  ];
  const messages = [
    {
      id: 'ms-demo-msg-1',
      subject: 'Microsoft Account Security Code: 849204',
      snippet: 'Use security code 849204 to verify your Microsoft sign-in request.',
      fromName: 'Microsoft Account Team',
      fromAddress: 'account-security-noreply@accountprotection.microsoft.com',
      sender: 'account-security-noreply@accountprotection.microsoft.com',
      recipient: addr,
      receivedAt: now - 25_000,
      isRead: false,
      hasAttachments: false,
      otpCode: '849204',
      folderTag: 'Inbox',
      htmlBody: `<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:24px;color:#0f172a;"><h2 style="margin:0 0 12px;color:#0284c7;">Kode Keamanan Akun Microsoft</h2><p>Gunakan kode verifikasi berikut untuk menyelesaikan proses autentikasi:</p><div style="display:inline-block;padding:12px 20px;border-radius:12px;background:#e0f2fe;color:#075985;font-size:24px;font-weight:800;letter-spacing:4px;">849204</div><p style="margin-top:16px;color:#475569;font-size:13px;">Pesan diterima melalui Microsoft Graph Mail Reader.</p></div>`,
      textBody: 'Gunakan kode verifikasi 849204 untuk menyelesaikan proses autentikasi.',
    },
    {
      id: 'ms-demo-msg-2',
      subject: 'Your OpenAI Verification Code is 531908',
      snippet: 'Enter code 531908 to continue logging in. Delivered to Junk folder.',
      fromName: 'OpenAI Verify',
      fromAddress: 'noreply@tm.openai.com',
      sender: 'noreply@tm.openai.com',
      recipient: addr,
      receivedAt: now - 140_000,
      isRead: false,
      hasAttachments: false,
      otpCode: '531908',
      folderTag: 'Junk',
      htmlBody: `<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:24px;color:#0f172a;"><h2 style="margin:0 0 10px;color:#0284c7;">Kode Login OpenAI</h2><p>Kode OTP Anda: <strong>531908</strong></p></div>`,
      textBody: 'Kode OTP Anda: 531908',
    },
    {
      id: 'ms-demo-msg-3',
      subject: 'Selamat Datang di Outlook Mail Reader AMC',
      snippet: 'Kotak masuk Outlook dan Hotmail Anda berhasil terhubung tanpa menyimpan kredensial.',
      fromName: 'Outlook Team',
      fromAddress: 'no-reply@microsoft.com',
      sender: 'no-reply@microsoft.com',
      recipient: addr,
      receivedAt: now - 600_000,
      isRead: true,
      hasAttachments: false,
      otpCode: null,
      folderTag: 'Inbox',
      htmlBody: `<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:24px;color:#0f172a;"><h2 style="margin:0 0 10px;color:#0284c7;">Kotak Masuk Terhubung</h2><p>Seluruh pesan dari Inbox dan Junk Email ditampilkan langsung dalam satu tampilan utuh.</p></div>`,
      textBody: 'Seluruh pesan dari Inbox dan Junk Email ditampilkan langsung dalam satu tampilan utuh.',
    },
  ];
  return { email: addr, displayName: 'Demo Outlook User', folders, messages };
}

export async function connectMicrosoftMailbox({
  combo = '',
  email = '',
  refreshToken = '',
  clientId = '',
  folder = 'all_incoming',
  allowMock = false,
  fetchImpl = fetch,
} = {}) {
  const parsed = parseMicrosoftCombo(combo, { email, refreshToken, clientId });
  if (!parsed.valid) {
    return { ok: false, status: 400, error: parsed.error, code: 'INVALID_COMBO' };
  }

  if (allowMock && parsed.clientId === DEMO_MS_CLIENT_ID) {
    const mock = buildMockMicrosoftData(parsed.email);
    return {
      ok: true,
      email: mock.email,
      displayName: mock.displayName,
      clientId: parsed.clientId,
      accessToken: 'mock-ms-access-token',
      refreshToken: parsed.refreshToken,
      expiresIn: 3600,
      folders: mock.folders,
      folder: folder || 'all_incoming',
      messages: mock.messages.map(({ htmlBody, textBody, ...summary }) => summary),
    };
  }

  const tokenRes = await refreshMicrosoftAccessToken({
    refreshToken: parsed.refreshToken,
    clientId: parsed.clientId,
    fetchImpl,
  });
  if (!tokenRes.ok) {
    return { ok: false, status: tokenRes.status, error: tokenRes.error, code: 'OAUTH_FAILED' };
  }

  const [meRes, foldersRes, msgsResult] = await Promise.all([
    graphGet('/me?$select=displayName,mail,userPrincipalName', tokenRes.accessToken, fetchImpl),
    graphGet(
      '/me/mailFolders?$top=25&$select=id,displayName,totalItemCount,unreadItemCount',
      tokenRes.accessToken,
      fetchImpl
    ),
    listMicrosoftMessagesInternal({
      accessToken: tokenRes.accessToken,
      folder: folder || 'all_incoming',
      top: 35,
      fetchImpl,
    }),
  ]);

  if (!msgsResult.ok) {
    return {
      ok: false,
      status: msgsResult.status || 403,
      error: msgsResult.error || 'Token berhasil ditukar tetapi tidak memiliki akses membaca pesan (Mail.Read).',
      code: 'GRAPH_MAIL_DENIED',
    };
  }

  const resolvedEmail =
    String(meRes.data?.mail || meRes.data?.userPrincipalName || parsed.email || msgsResult.messages[0]?.recipient || '')
      .trim()
      .toLowerCase();
  const displayName = String(meRes.data?.displayName || resolvedEmail || 'Microsoft Mailbox').trim();

  const rawFolders = Array.isArray(foldersRes.data?.value) ? foldersRes.data.value : [];
  const folders = buildFolderOptions(rawFolders, msgsResult.messages.length);

  return {
    ok: true,
    email: resolvedEmail || 'Terhubung ke Microsoft',
    displayName,
    clientId: parsed.clientId,
    accessToken: tokenRes.accessToken,
    refreshToken: tokenRes.refreshToken,
    expiresIn: tokenRes.expiresIn,
    folders,
    folder: folder || 'all_incoming',
    messages: msgsResult.messages,
  };
}

function buildFolderOptions(graphFolders, fallbackCount = 0) {
  if (!graphFolders || graphFolders.length === 0) {
    return STANDARD_FOLDERS.map((f, idx) => ({
      id: f.id,
      displayName: f.displayName,
      totalItemCount: idx === 0 ? fallbackCount : 0,
      unreadItemCount: 0,
    }));
  }

  let inboxCount = 0;
  let junkCount = 0;
  let inboxUnread = 0;
  let junkUnread = 0;

  const mapped = graphFolders.map((f) => {
    const dn = String(f.displayName || 'Folder');
    const total = Number(f.totalItemCount || 0);
    const unread = Number(f.unreadItemCount || 0);
    if (/^inbox$|^kotak masuk$/i.test(dn)) {
      inboxCount += total;
      inboxUnread += unread;
    } else if (/junk|spam/i.test(dn)) {
      junkCount += total;
      junkUnread += unread;
    }
    return {
      id: f.id,
      displayName: dn,
      totalItemCount: total,
      unreadItemCount: unread,
    };
  });

  return [
    {
      id: 'all_incoming',
      displayName: 'Semua Masuk (Inbox + Junk)',
      totalItemCount: inboxCount + junkCount,
      unreadItemCount: inboxUnread + junkUnread,
    },
    ...mapped,
  ];
}

async function listMicrosoftMessagesInternal({ accessToken, folder = 'all_incoming', top = 35, fetchImpl = fetch }) {
  if (folder === 'all_incoming') {
    const [inboxRes, junkRes] = await Promise.all([
      fetchFolderMessages(accessToken, 'inbox', top, fetchImpl),
      fetchFolderMessages(accessToken, 'junkemail', 25, fetchImpl),
    ]);

    if (!inboxRes.ok && !junkRes.ok) {
      const graphMsg = inboxRes.data?.error?.message || junkRes.data?.error?.message || '';
      return {
        ok: false,
        status: inboxRes.status || 403,
        error: graphMsg
          ? `Microsoft Graph menolak akses kotak masuk: ${graphMsg}`
          : 'Gagal mengambil daftar pesan dari Microsoft Graph.',
      };
    }

    const byId = new Map();
    for (const item of inboxRes.data?.value || []) {
      const norm = normalizeGraphMessageSummary(item, 'Inbox');
      byId.set(norm.id, norm);
    }
    for (const item of junkRes.data?.value || []) {
      const norm = normalizeGraphMessageSummary(item, 'Junk');
      if (!byId.has(norm.id)) byId.set(norm.id, norm);
    }

    const merged = Array.from(byId.values()).sort((a, b) => b.receivedAt - a.receivedAt);
    return { ok: true, messages: merged.slice(0, top) };
  }

  const folderRes = await fetchFolderMessages(accessToken, folder, top, fetchImpl);
  if (!folderRes.ok) {
    const graphMsg = folderRes.data?.error?.message || '';
    return {
      ok: false,
      status: folderRes.status || 403,
      error: graphMsg || 'Gagal membaca folder email Microsoft.',
    };
  }

  const list = (folderRes.data?.value || []).map((item) => normalizeGraphMessageSummary(item, ''));
  return { ok: true, messages: list };
}

export async function listMicrosoftMessages({
  accessToken = '',
  refreshToken = '',
  clientId = '',
  email = '',
  folder = 'all_incoming',
  top = 35,
  allowMock = false,
  fetchImpl = fetch,
} = {}) {
  if (allowMock && clientId === DEMO_MS_CLIENT_ID) {
    const mock = buildMockMicrosoftData(email);
    let filtered = mock.messages;
    if (folder === 'inbox') filtered = mock.messages.filter((m) => m.folderTag === 'Inbox');
    else if (folder === 'junkemail') filtered = mock.messages.filter((m) => m.folderTag === 'Junk');
    else if (folder !== 'all_incoming') filtered = [];
    return {
      ok: true,
      accessToken: 'mock-ms-access-token',
      refreshToken,
      messages: filtered.map(({ htmlBody, textBody, ...s }) => s),
    };
  }

  let tokenToUse = String(accessToken || '').trim();
  let nextRefresh = String(refreshToken || '').trim();

  if (!tokenToUse) {
    if (!nextRefresh || !clientId) {
      return { ok: false, status: 400, error: 'Kredensial sesi Microsoft tidak lengkap.' };
    }
    const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
  }

  let res = await listMicrosoftMessagesInternal({ accessToken: tokenToUse, folder, top, fetchImpl });
  if (!res.ok && res.status === 401 && nextRefresh && clientId) {
    const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
    res = await listMicrosoftMessagesInternal({ accessToken: tokenToUse, folder, top, fetchImpl });
  }

  if (!res.ok) return res;
  return {
    ok: true,
    accessToken: tokenToUse,
    refreshToken: nextRefresh,
    messages: res.messages,
  };
}

export async function getMicrosoftMessageDetail({
  accessToken = '',
  refreshToken = '',
  clientId = '',
  email = '',
  messageId = '',
  allowMock = false,
  fetchImpl = fetch,
} = {}) {
  if (!messageId) {
    return { ok: false, status: 400, error: 'ID pesan Microsoft diperlukan.' };
  }

  if (allowMock && clientId === DEMO_MS_CLIENT_ID) {
    const mock = buildMockMicrosoftData(email);
    const found = mock.messages.find((m) => m.id === messageId) || mock.messages[0];
    return {
      ok: true,
      accessToken: 'mock-ms-access-token',
      refreshToken,
      email: {
        id: found.id,
        subject: found.subject,
        fromName: found.fromName,
        fromAddress: found.fromAddress,
        sender: found.sender,
        recipient: found.recipient,
        receivedAt: found.receivedAt,
        sizeBytes: (found.htmlBody || found.textBody || '').length,
        otpCode: found.otpCode,
        htmlBody: found.htmlBody,
        textBody: found.textBody,
        headers: [
          { key: 'From', value: `${found.fromName} <${found.fromAddress}>` },
          { key: 'To', value: found.recipient },
          { key: 'Subject', value: found.subject },
        ],
        attachments: [],
      },
    };
  }

  let tokenToUse = String(accessToken || '').trim();
  let nextRefresh = String(refreshToken || '').trim();

  if (!tokenToUse && nextRefresh && clientId) {
    const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
  }

  const select =
    'id,subject,body,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,internetMessageHeaders';
  const safeId = encodeURIComponent(messageId);

  let msgRes = await graphGet(`/me/messages/${safeId}?$select=${select}`, tokenToUse, fetchImpl);
  if (!msgRes.ok && msgRes.status === 401 && nextRefresh && clientId) {
    const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
    msgRes = await graphGet(`/me/messages/${safeId}?$select=${select}`, tokenToUse, fetchImpl);
  }

  if (!msgRes.ok) {
    return {
      ok: false,
      status: msgRes.status || 404,
      error: msgRes.data?.error?.message || 'Gagal membuka detail pesan dari Microsoft Graph.',
    };
  }

  const m = msgRes.data || {};
  const contentType = String(m.body?.contentType || 'text').toLowerCase();
  const rawContent = String(m.body?.content || '');
  let htmlBody = contentType === 'html' ? rawContent : '';
  const textBody = contentType === 'html' ? stripHtmlSimple(rawContent) : rawContent || String(m.bodyPreview || '');

  const attachments = [];
  if (m.hasAttachments) {
    const attRes = await graphGet(
      `/me/messages/${safeId}/attachments?$select=id,name,contentType,size,isInline,contentId,contentBytes`,
      tokenToUse,
      fetchImpl
    );
    if (attRes.ok && Array.isArray(attRes.data?.value)) {
      const cidMap = new Map();
      for (const att of attRes.data.value) {
        const mime = String(att.contentType || 'application/octet-stream');
        const b64 = String(att.contentBytes || '');
        const cleanCid = String(att.contentId || '')
          .trim()
          .replace(/^<+|>+$/g, '');

        if (cleanCid && b64 && mime.toLowerCase().startsWith('image/') && b64.length <= 2_800_000) {
          cidMap.set(cleanCid, `data:${mime};base64,${b64}`);
          cidMap.set(cleanCid.toLowerCase(), `data:${mime};base64,${b64}`);
        }

        if (!att.isInline) {
          attachments.push({
            id: String(att.id || ''),
            filename: String(att.name || 'lampiran'),
            mimeType: mime,
            sizeBytes: Number(att.size || 0),
            dataUrl: b64 && b64.length <= 4_000_000 ? `data:${mime};base64,${b64}` : null,
          });
        }
      }

      if (htmlBody && cidMap.size > 0) {
        htmlBody = htmlBody.replace(
          /(src\s*=\s*["'])cid:([^"']+)(["'])/gi,
          (full, pre, rawCid, post) => {
            const key = decodeURIComponent(rawCid).trim().replace(/^<+|>+$/g, '');
            const uri = cidMap.get(key) || cidMap.get(key.toLowerCase());
            return uri ? `${pre}${uri}${post}` : full;
          }
        );
      }
    }
  }

  const fromObj = m.from?.emailAddress || m.sender?.emailAddress || {};
  const fromName = String(fromObj.name || '').trim();
  const fromAddress = String(fromObj.address || '').trim();
  const recipients = (m.toRecipients || [])
    .map((r) => r?.emailAddress?.address)
    .filter(Boolean)
    .join(', ');
  const subject = String(m.subject || '(Tanpa Subjek)');
  const receivedAt = m.receivedDateTime ? Date.parse(m.receivedDateTime) || Date.now() : Date.now();
  const otpCode = extractOtpCode(subject, textBody, htmlBody, false);
  const headers = (m.internetMessageHeaders || []).map((h) => ({
    key: String(h.name || ''),
    value: String(h.value || ''),
  }));

  return {
    ok: true,
    accessToken: tokenToUse,
    refreshToken: nextRefresh,
    email: {
      id: String(m.id || messageId),
      subject,
      fromName: fromName || fromAddress || 'Microsoft Sender',
      fromAddress,
      sender: fromAddress || fromName || 'unknown',
      recipient: recipients || email || '-',
      receivedAt,
      sizeBytes: rawContent.length,
      otpCode: otpCode || null,
      htmlBody,
      textBody,
      headers,
      attachments,
    },
  };
}
