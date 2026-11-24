import PostalMime from 'postal-mime';
import { extractOtpCode, parseIncomingEmail } from './email-parser.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_ANYWHERE_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL_REGEX = /^[^\s@:|;]+@[^\s@:|;]+\.[^\s@:|;]+$/;
const EMAIL_ANYWHERE_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export const DEMO_MS_CLIENT_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_MS_EMAIL = 'demo.outlook@hotmail.com';
export const MS_OFFICE_CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
export const THUNDERBIRD_CLIENT_ID = '9e5f94bc-e8a4-4e73-b8be-63364c29d753';

export const PUBLIC_MS_CLIENT_IDS = [
  THUNDERBIRD_CLIENT_ID,
  MS_OFFICE_CLIENT_ID,
  'dbc8e03a-b00c-46bd-ae65-b683e7707cb0',
  '04b07795-8ddb-461a-bbee-02f9e1bf7b46',
];

const MS_CONSUMER_DOMAIN_REGEX = /^(?:outlook|hotmail|live|msn|windowslive|passport)\.[a-z0-9.-]+$/i;
const NON_MS_KNOWN_IMAP_HOSTS = [
  { test: /^(?:gmail|googlemail)\.com$/i, host: 'imap.gmail.com', port: 993, provider: 'Gmail' },
  { test: /^(?:yahoo|ymail|rocketmail)\.[a-z0-9.-]+$/i, host: 'imap.mail.yahoo.com', port: 993, provider: 'Yahoo Mail' },
  { test: /^(?:icloud|me|mac)\.com$/i, host: 'imap.mail.me.com', port: 993, provider: 'iCloud Mail' },
  { test: /^zoho\.[a-z0-9.-]+$/i, host: 'imap.zoho.com', port: 993, provider: 'Zoho Mail' },
  { test: /^aol\.com$/i, host: 'imap.aol.com', port: 993, provider: 'AOL Mail' },
  { test: /^gmx\.[a-z0-9.-]+$/i, host: 'imap.gmx.com', port: 993, provider: 'GMX Mail' },
  { test: /^yandex\.[a-z0-9.-]+$/i, host: 'imap.yandex.com', port: 993, provider: 'Yandex Mail' },
];

const STANDARD_FOLDERS = [
  { id: 'all_incoming', displayName: 'Semua Masuk (Inbox + Junk)', wellKnown: true },
  { id: 'inbox', displayName: 'Inbox', wellKnown: true },
  { id: 'junkemail', displayName: 'Junk Email (Spam)', wellKnown: true },
  { id: 'sentitems', displayName: 'Sent Items', wellKnown: true },
  { id: 'drafts', displayName: 'Drafts', wellKnown: true },
  { id: 'deleteditems', displayName: 'Deleted Items', wellKnown: true },
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

export function isConsumerMicrosoftEmail(email = '') {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return MS_CONSUMER_DOMAIN_REGEX.test(domain);
}

function getEmailDomain(email = '') {
  const parts = String(email || '').trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

function looksLikeMsRefreshToken(token = '', hasExplicitClientId = false) {
  const s = String(token || '').trim();
  if (!s || s.includes(' ')) return false;
  if (/^(?:M\.|0\.A|1\.A|OAQ|Ew[A-Za-z0-9])/i.test(s) && s.length >= 24) return true;
  if (s.length >= 64 && /^[A-Za-z0-9._~+!$/=-]+$/.test(s)) return true;
  if (hasExplicitClientId && s.length >= 24 && /^[A-Za-z0-9._~+!$/=-]+$/.test(s)) return true;
  return false;
}

function splitFlexibleComboLine(rawLine = '') {
  const line = String(rawLine || '').trim();
  if (!line) return [];

  if (line.includes('|')) {
    return line.split('|').map((t) => t.trim()).filter(Boolean);
  }
  if (line.includes('----')) {
    return line.split('----').map((t) => t.trim()).filter(Boolean);
  }
  if (line.includes('\t')) {
    return line.split('\t').map((t) => t.trim()).filter(Boolean);
  }
  if (line.includes(';')) {
    return line.split(';').map((t) => t.trim()).filter(Boolean);
  }
  if (line.includes(':')) {
    const rawParts = line.split(':');
    const hasUuid = UUID_ANYWHERE_REGEX.test(line);
    const hasOauthToken = rawParts.some((p) => looksLikeMsRefreshToken(p, hasUuid));
    if (!hasUuid && !hasOauthToken) {
      // Plain email:password — split only on first ':' so passwords containing ':' remain intact.
      const firstColon = line.indexOf(':');
      const left = line.slice(0, firstColon).trim();
      const right = line.slice(firstColon + 1).trim();
      return [left, right].filter(Boolean);
    }
    return rawParts.map((t) => t.trim()).filter(Boolean);
  }

  const wsMatch = line.match(/^([^\s@:|;]+@[^\s@:|;]+\.[^\s@:|;]+)\s+(.+)$/);
  if (wsMatch) {
    return [wsMatch[1].trim(), wsMatch[2].trim()];
  }

  return line.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}

/**
 * Non-strict Microsoft / Mail credential parser.
 * Accepts:
 *  - Separate { email, password } fields (no UUID or refresh_token required!)
 *  - Quick combo "email:password" or "email|password" or "email----password"
 *  - 3-part combo "email|password|refresh_token" (auto-resolves public client_id!)
 *  - 4-part combo "email|password|refresh_token|client_id" or "refresh_token|client_id"
 */
export function parseMicrosoftCombo(rawCombo = '', explicit = {}) {
  let explicitEmail = String(explicit.email || '').trim();
  let explicitPassword = String(explicit.password || '');
  let explicitRefresh = String(explicit.refreshToken || '').trim();
  let explicitClientId = String(explicit.clientId || '').trim();
  const imapHost = String(explicit.imapHost || '').trim().toLowerCase();
  const imapPort = Number(explicit.imapPort || 993) || 993;

  // Allow pasting "email:password" or full combo directly into the email field.
  let comboSource = String(rawCombo || '').trim();
  if (!comboSource && explicitEmail && /[|:;\t]|----/.test(explicitEmail)) {
    comboSource = explicitEmail;
    explicitEmail = '';
  }

  const firstLine = comboSource
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean) || '';

  let comboEmail = '';
  let comboPassword = '';
  let comboRefresh = '';
  let comboClientId = '';

  if (firstLine) {
    const tokens = splitFlexibleComboLine(firstLine);
    const remaining = [];

    for (const tok of tokens) {
      if (!comboClientId && UUID_REGEX.test(tok)) {
        comboClientId = tok.toLowerCase();
        continue;
      }
      if (!comboEmail && EMAIL_REGEX.test(tok)) {
        comboEmail = tok.toLowerCase();
        continue;
      }
      remaining.push(tok);
    }

    if (!comboClientId) {
      const m = firstLine.match(UUID_ANYWHERE_REGEX);
      if (m) comboClientId = m[0].toLowerCase();
    }
    if (!comboEmail) {
      const m = firstLine.match(EMAIL_ANYWHERE_REGEX);
      if (m) comboEmail = m[0].toLowerCase();
    }

    const filtered = remaining.filter(
      (t) => t.toLowerCase() !== comboClientId && t.toLowerCase() !== comboEmail
    );

    const tokenIdx = filtered.findIndex((t) => looksLikeMsRefreshToken(t, Boolean(comboClientId)));
    if (tokenIdx >= 0) {
      comboRefresh = filtered[tokenIdx];
      const others = filtered.filter((_, idx) => idx !== tokenIdx);
      if (others.length > 0) {
        comboPassword = others[0];
      }
    } else if (filtered.length >= 2 && comboClientId) {
      // When UUID is present and 2 tokens remain, longer >=24 token is refreshToken and shorter is password.
      const sorted = [...filtered].sort((a, b) => b.length - a.length);
      if (sorted[0].length >= 24) {
        comboRefresh = sorted[0];
        comboPassword = filtered.find((x) => x !== comboRefresh) || '';
      } else {
        comboPassword = filtered[0];
      }
    } else if (filtered.length === 1) {
      if (looksLikeMsRefreshToken(filtered[0], Boolean(comboClientId))) {
        comboRefresh = filtered[0];
      } else {
        comboPassword = filtered[0];
      }
    } else if (filtered.length > 1) {
      comboPassword = filtered.join(':');
    }
  }

  const email = (explicitEmail || comboEmail).trim().toLowerCase();
  const password = explicitPassword || comboPassword;
  const refreshToken = (explicitRefresh || comboRefresh).trim();
  const clientId = (explicitClientId || comboClientId).trim().toLowerCase();

  if (clientId && !UUID_REGEX.test(clientId)) {
    return {
      valid: false,
      error: 'Format Client ID (opsional) tidak valid — kosongkan saja jika Anda login menggunakan Email & Password.',
    };
  }

  const hasValidEmail = EMAIL_REGEX.test(email);
  const hasPassword = Boolean(password && String(password).length > 0);
  const hasRefreshToken = Boolean(refreshToken && refreshToken.length >= 20);

  if (!hasRefreshToken && !hasValidEmail && !email) {
    return {
      valid: false,
      error: 'Masukkan Email dan Password Microsoft Anda (atau tempel format email:password / email|password).',
    };
  }

  if (!hasRefreshToken && email && !hasValidEmail) {
    return {
      valid: false,
      error: 'Format alamat email tidak valid. Contoh: nama@outlook.com.',
    };
  }

  if (!hasRefreshToken && hasValidEmail && !hasPassword) {
    return {
      valid: false,
      error: 'Masukkan Password untuk membuka kotak masuk email tersebut.',
    };
  }

  const mode = hasRefreshToken && hasPassword ? 'hybrid' : hasRefreshToken ? 'oauth' : 'password';

  return {
    valid: true,
    mode,
    email: hasValidEmail ? email : '',
    password: hasPassword ? String(password) : '',
    refreshToken: hasRefreshToken ? refreshToken : '',
    clientId,
    imapHost,
    imapPort,
  };
}

export const parseMicrosoftCredentials = parseMicrosoftCombo;

function stripHtmlSimple(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBase64Url(str) {
  const bytes = textEncoder.encode(String(str || ''));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url) {
  try {
    const padded = String(b64url || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(String(b64url || '').length / 4) * 4, '=');
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return textDecoder.decode(bytes);
  } catch {
    return '';
  }
}

function decodeJwtClaimsSafe(jwt = '') {
  try {
    const parts = String(jwt || '').split('.');
    if (parts.length < 2) return null;
    const raw = fromBase64Url(parts[1]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function extractEmailFromTokenClaims(accessToken = '', idToken = '') {
  for (const tok of [idToken, accessToken]) {
    const claims = decodeJwtClaimsSafe(tok);
    if (!claims) continue;
    for (const field of ['email', 'preferred_username', 'upn', 'unique_name']) {
      const candidate = String(claims[field] || '').trim().toLowerCase();
      if (EMAIL_REGEX.test(candidate)) return candidate;
    }
  }
  return '';
}

function translateMicrosoftTokenError(errJson, status) {
  const code = String(errJson?.error || '').toLowerCase();
  const desc = String(errJson?.error_description || '');
  if (desc.includes('AADSTS50126')) {
    return 'Email atau Password Microsoft salah. Periksa kembali penulisan sandi Anda.';
  }
  if (desc.includes('AADSTS50053')) {
    return 'Akun Microsoft dikunci sementara karena terlalu banyak percobaan login.';
  }
  if (desc.includes('AADSTS50057')) {
    return 'Akun Microsoft ini telah dinonaktifkan.';
  }
  if (desc.includes('AADSTS50076') || desc.includes('AADSTS50079') || desc.includes('AADSTS50158')) {
    return 'Akun ini mengaktifkan verifikasi 2 langkah (MFA). Gunakan Login Cepat Microsoft di bawah.';
  }
  if (code === 'invalid_grant' || desc.includes('AADSTS70000') || desc.includes('AADSTS70008')) {
    return 'Sesi atau Refresh Token ditolak Microsoft (kedaluwarsa atau tidak cocok).';
  }
  if (code === 'unauthorized_client' || desc.includes('AADSTS700016') || desc.includes('AADSTS50020')) {
    return 'Aplikasi OAuth tidak diizinkan untuk tipe akun Microsoft ini.';
  }
  if (code === 'invalid_client' || desc.includes('AADSTS7000218')) {
    return 'Client ID memerlukan client_secret (bukan aplikasi Public Client).';
  }
  if (code === 'invalid_scope' || desc.includes('AADSTS70011')) {
    return 'Token tidak memiliki izin membaca kotak masuk.';
  }
  return `Gagal autentikasi Microsoft (HTTP ${status}): ${code || 'OAuth error'}`;
}

export async function refreshMicrosoftAccessToken({ refreshToken, clientId = '', fetchImpl = fetch }) {
  const clientCandidates = clientId ? [clientId] : PUBLIC_MS_CLIENT_IDS;

  let lastError = 'Gagal menghubungkan ke server OAuth Microsoft.';
  let lastStatus = 401;
  let fallbackToken = null;

  for (const candidateClientId of clientCandidates) {
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
      {
        url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access',
      },
    ];

    for (const attempt of attempts) {
      const params = new URLSearchParams({
        client_id: candidateClientId,
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
        const tokenEmail = extractEmailFromTokenClaims(data.access_token, data.id_token);
        const tokenResult = {
          ok: true,
          clientId: candidateClientId,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresIn: Number(data.expires_in || 3600),
          scope: grantedScope,
          email: tokenEmail,
        };
        if (
          !grantedScope ||
          /mail\.read|mail\.readwrite|imap\.accessasuser\.all/i.test(grantedScope)
        ) {
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
      const desc = String(data?.error_description || '');
      // If refresh token doesn't belong to this clientId, move immediately to next candidateClientId.
      if (
        !clientId &&
        (errCode === 'invalid_client' ||
          errCode === 'unauthorized_client' ||
          desc.includes('AADSTS70000') ||
          desc.includes('AADSTS700016'))
      ) {
        break;
      }
      if (errCode === 'invalid_client') {
        break;
      }
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

/**
 * Direct Email + Password authentication via Microsoft OAuth2 ROPC (grant_type=password).
 * Works directly for Microsoft 365 / Organizational / Education / Custom Entra ID tenants without MFA.
 */
export async function authenticateMicrosoftPasswordROPC({
  email,
  password,
  clientId = '',
  fetchImpl = fetch,
}) {
  const domain = getEmailDomain(email);
  const clientCandidates = clientId
    ? [clientId]
    : [MS_OFFICE_CLIENT_ID, THUNDERBIRD_CLIENT_ID];

  const tenantPath = domain && !MS_CONSUMER_DOMAIN_REGEX.test(domain) ? encodeURIComponent(domain) : 'organizations';
  const attempts = [];

  for (const cid of clientCandidates) {
    attempts.push({
      version: 'v2',
      url: `https://login.microsoftonline.com/${tenantPath}/oauth2/v2.0/token`,
      clientId: cid,
      scope:
        cid === THUNDERBIRD_CLIENT_ID
          ? 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access openid email'
          : 'https://graph.microsoft.com/.default offline_access openid email',
    });
  }
  attempts.push({
    version: 'v1',
    url: 'https://login.microsoftonline.com/organizations/oauth2/token',
    clientId: clientId || MS_OFFICE_CLIENT_ID,
    resource: 'https://graph.microsoft.com',
  });

  let sawMfa = false;
  let sawTenantNotFound = false;
  let lastError = '';

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      client_id: attempt.clientId,
      grant_type: 'password',
      username: email,
      password,
    });
    if (attempt.version === 'v2') {
      params.set('scope', attempt.scope);
    } else {
      params.set('resource', attempt.resource);
    }

    let res;
    try {
      res = await fetchImpl(attempt.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });
    } catch (err) {
      lastError = err?.message || 'Gagal menghubungi endpoint login Microsoft.';
      continue;
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) {
      return {
        ok: true,
        clientId: attempt.clientId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresIn: Number(data.expires_in || 3600),
        scope: String(data.scope || ''),
        email: extractEmailFromTokenClaims(data.access_token, data.id_token) || email,
      };
    }

    const desc = String(data?.error_description || '');
    const codes = Array.isArray(data?.error_codes) ? data.error_codes.map(Number) : [];

    if (codes.includes(50126) || desc.includes('AADSTS50126')) {
      return {
        ok: false,
        reason: 'invalid_credentials',
        status: 401,
        error: 'Email atau Password Microsoft salah. Periksa kembali penulisan sandi Anda.',
      };
    }
    if (codes.includes(50053) || desc.includes('AADSTS50053')) {
      return {
        ok: false,
        reason: 'account_locked',
        status: 403,
        error: 'Akun Microsoft dikunci sementara karena terlalu banyak percobaan masuk.',
      };
    }
    if (
      codes.some((c) => [50076, 50079, 50158, 53003].includes(c)) ||
      /AADSTS(?:50076|50079|50158|53003)/.test(desc)
    ) {
      sawMfa = true;
      lastError = translateMicrosoftTokenError(data, res.status);
      break;
    }
    if (
      codes.some((c) => [50034, 50059, 90002].includes(c)) ||
      /AADSTS(?:50034|50059|90002)/.test(desc)
    ) {
      sawTenantNotFound = true;
      lastError = translateMicrosoftTokenError(data, res.status);
      break;
    }

    lastError = translateMicrosoftTokenError(data, res.status);
  }

  if (sawMfa) {
    return {
      ok: false,
      reason: 'requires_mfa',
      status: 428,
      error: lastError,
    };
  }
  if (sawTenantNotFound) {
    return {
      ok: false,
      reason: 'non_entra_domain',
      status: 404,
      error: lastError,
    };
  }
  return {
    ok: false,
    reason: 'ropc_blocked',
    status: 401,
    error: lastError || 'Login sandi langsung tidak diizinkan oleh tenant ini.',
  };
}

/**
 * Official Microsoft OAuth2 Device Code flow (works on ALL personal @hotmail/@outlook/@live
 * and MFA-protected Microsoft 365 accounts with zero UUID/token setup).
 */
export async function startMicrosoftDeviceAuth({ email = '', fetchImpl = fetch } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const tenant = isConsumerMicrosoftEmail(cleanEmail) ? 'consumers' : 'common';
  const clientId = MS_OFFICE_CLIENT_ID;
  const scope = 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access';

  const params = new URLSearchParams({
    client_id: clientId,
    scope,
  });

  const res = await fetchImpl(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.device_code || !data.user_code) {
    return {
      ok: false,
      status: res.status || 502,
      error: translateMicrosoftTokenError(data, res.status || 502),
    };
  }

  return {
    ok: true,
    clientId,
    tenant,
    emailHint: cleanEmail,
    userCode: String(data.user_code),
    deviceCode: String(data.device_code),
    verificationUri: String(data.verification_uri || 'https://www.microsoft.com/link'),
    expiresIn: Number(data.expires_in || 900),
    interval: Math.max(3, Number(data.interval || 5)),
  };
}

export async function pollMicrosoftDeviceAuth({
  deviceCode = '',
  clientId = MS_OFFICE_CLIENT_ID,
  tenant = 'common',
  email = '',
  folder = 'all_incoming',
  fetchImpl = fetch,
  socketFactory = null,
} = {}) {
  if (!deviceCode) {
    return { ok: false, status: 400, error: 'Kode sesi perangkat Microsoft tidak ditemukan.' };
  }
  const safeTenant = ['consumers', 'organizations', 'common'].includes(tenant) ? tenant : 'common';
  const safeClientId = UUID_REGEX.test(clientId) ? clientId : MS_OFFICE_CLIENT_ID;

  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    client_id: safeClientId,
    device_code: deviceCode,
  });

  const res = await fetchImpl(`https://login.microsoftonline.com/${safeTenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const errCode = String(data?.error || '').toLowerCase();
    if (errCode === 'authorization_pending' || errCode === 'slow_down') {
      return {
        ok: true,
        pending: true,
        slowDown: errCode === 'slow_down',
      };
    }
    if (errCode === 'expired_token') {
      return {
        ok: false,
        status: 410,
        error: 'Kode verifikasi Microsoft sudah kedaluwarsa. Silakan buat kode baru.',
      };
    }
    if (errCode === 'authorization_declined' || errCode === 'access_denied') {
      return {
        ok: false,
        status: 403,
        error: 'Permintaan login ditolak pada halaman Microsoft.',
      };
    }
    return {
      ok: false,
      status: 400,
      error: translateMicrosoftTokenError(data, res.status || 400),
    };
  }

  const resolvedHint = extractEmailFromTokenClaims(data.access_token, data.id_token) || email;
  const connected = await openMailboxWithOAuthToken({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    clientId: safeClientId,
    emailHint: resolvedHint,
    folder,
    fetchImpl,
    socketFactory,
  });

  if (!connected.ok) return connected;
  return {
    ...connected,
    pending: false,
    connected: true,
  };
}

/* =========================================================
 * IMAPS over TLS Client (cloudflare:sockets + Node TLS fallback)
 * Supports AUTH=XOAUTH2 (Outlook/Exchange) & LOGIN / AUTH=PLAIN
 * ========================================================= */

async function openTlsSocket({ host, port = 993, socketFactory = null, timeoutMs = 8000 }) {
  if (typeof socketFactory === 'function') {
    return socketFactory({ host, port, timeoutMs });
  }

  try {
    const cfSockets = await import('cloudflare:sockets');
    if (cfSockets && typeof cfSockets.connect === 'function') {
      const sock = cfSockets.connect(
        { hostname: host, port: Number(port) },
        { secureTransport: 'on', allowHalfOpen: false }
      );
      return {
        readable: sock.readable,
        writable: sock.writable,
        close: () => {
          try { sock.close(); } catch {}
        },
      };
    }
  } catch {
    // Fallback to node:tls when executed in plain Node.js outside workerd.
  }

  const tls = await import('node:tls');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout koneksi TLS ke ${host}:${port}`));
    }, timeoutMs);

    const sock = tls.connect(
      { host, port: Number(port), servername: host, rejectUnauthorized: true },
      () => {
        clearTimeout(timer);
        const readable = new ReadableStream({
          start(controller) {
            sock.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
            sock.on('end', () => {
              try { controller.close(); } catch {}
            });
            sock.on('error', (err) => {
              try { controller.error(err); } catch {}
            });
          },
          cancel() {
            try { sock.destroy(); } catch {}
          },
        });
        const writable = new WritableStream({
          write(chunk) {
            return new Promise((resWrite, rejWrite) => {
              sock.write(chunk, (err) => (err ? rejWrite(err) : resWrite()));
            });
          },
          close() {
            try { sock.end(); } catch {}
          },
        });
        resolve({
          readable,
          writable,
          close: () => {
            try { sock.destroy(); } catch {}
          },
        });
      }
    );

    sock.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function concatBytes(a, b) {
  if (!a || a.length === 0) return b;
  if (!b || b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function findCrlfIndex(buf, start = 0) {
  for (let i = start; i < buf.length - 1; i += 1) {
    if (buf[i] === 13 && buf[i + 1] === 10) return i;
  }
  return -1;
}

function quoteImapAtom(str) {
  return `"${String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function makeImapMessageId(mailbox, uid) {
  return `imap:${toBase64Url(mailbox)}:${String(uid)}`;
}

export function parseImapMessageId(messageId = '') {
  const raw = String(messageId || '');
  if (!raw.startsWith('imap:')) return null;
  const parts = raw.split(':');
  if (parts.length < 3) return null;
  const mailbox = fromBase64Url(parts[1]) || 'INBOX';
  const uid = parts.slice(2).join(':').replace(/[^\d]/g, '');
  if (!uid) return null;
  return { mailbox, uid };
}

class ImapTlsSession {
  constructor(socket, timeoutMs = 9000) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.buffer = new Uint8Array(0);
    this.seq = 0;
    this.timeoutMs = timeoutMs;
    this.capabilities = '';
  }

  async readMore() {
    let timer = null;
    try {
      const chunkRes = await Promise.race([
        this.reader.read(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Batas waktu respons server IMAP habis.')), this.timeoutMs);
        }),
      ]);
      if (chunkRes.done || !chunkRes.value) {
        throw new Error('Koneksi IMAP ditutup oleh server.');
      }
      this.buffer = concatBytes(this.buffer, chunkRes.value);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async ensureBytes(minLength) {
    while (this.buffer.length < minLength) {
      await this.readMore();
    }
  }

  async readRecord() {
    const parts = [];
    const literals = [];

    while (true) {
      let crlf = findCrlfIndex(this.buffer, 0);
      while (crlf === -1) {
        await this.readMore();
        crlf = findCrlfIndex(this.buffer, 0);
      }

      const lineBytes = this.buffer.subarray(0, crlf);
      this.buffer = this.buffer.subarray(crlf + 2);
      const lineText = textDecoder.decode(lineBytes);
      parts.push(lineText);

      const litMatch = lineText.match(/\{(\d+)\}\s*$/);
      if (!litMatch) {
        break;
      }

      const litLen = Number(litMatch[1] || 0);
      if (litLen > 0) {
        await this.ensureBytes(litLen);
        const litBytes = this.buffer.slice(0, litLen);
        this.buffer = this.buffer.subarray(litLen);
        literals.push(litBytes);
      } else {
        literals.push(new Uint8Array(0));
      }
    }

    return {
      text: parts.join(' '),
      literals,
    };
  }

  async writeRaw(strOrBytes) {
    const payload = typeof strOrBytes === 'string' ? textEncoder.encode(strOrBytes) : strOrBytes;
    await this.writer.write(payload);
  }

  async runCommand(command) {
    this.seq += 1;
    const tag = `A${String(this.seq).padStart(3, '0')}`;
    await this.writeRaw(`${tag} ${command}\r\n`);

    const untagged = [];
    while (true) {
      const rec = await this.readRecord();
      if (rec.text.startsWith(`${tag} `)) {
        const rest = rec.text.slice(tag.length + 1).trim();
        const status = (rest.split(/\s+/)[0] || '').toUpperCase();
        return {
          ok: status === 'OK',
          status,
          statusLine: rest,
          untagged,
        };
      }
      if (rec.text.startsWith('+')) {
        // Unexpected SASL error challenge -> acknowledge with empty CRLF so server sends tagged NO.
        await this.writeRaw('\r\n');
        continue;
      }
      untagged.push(rec);
    }
  }

  async connectAndAuthenticate({ authType, email, password = '', accessToken = '' }) {
    const greeting = await this.readRecord();
    if (!greeting.text.startsWith('* OK')) {
      return { ok: false, error: 'Server IMAP tidak merespons dengan status siap (* OK).' };
    }

    const capRes = await this.runCommand('CAPABILITY');
    const capLines = [greeting.text, ...capRes.untagged.map((u) => u.text), capRes.statusLine].join(' ');
    this.capabilities = capLines.toUpperCase();

    if (authType === 'xoauth2') {
      const rawSasl = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
      const b64 = btoa(rawSasl);
      const authRes = await this.runCommand(`AUTHENTICATE XOAUTH2 ${b64}`);
      if (!authRes.ok) {
        return {
          ok: false,
          status: 401,
          error: 'Autentikasi IMAP OAuth2 (XOAUTH2) ditolak oleh server Microsoft.',
        };
      }
      return { ok: true };
    }

    const loginDisabled = /\bLOGINDISABLED\b/.test(this.capabilities);
    const hasAuthPlain = /\bAUTH=PLAIN\b/.test(this.capabilities);

    if (loginDisabled && !hasAuthPlain) {
      return {
        ok: false,
        loginDisabled: true,
        status: 428,
        error: 'Server email ini menonaktifkan login sandi biasa (wajib OAuth2 / Modern Auth).',
      };
    }

    if (!loginDisabled) {
      const hasControlOrNonAscii = /[^\x20-\x7e]/.test(password);
      if (!hasControlOrNonAscii) {
        const loginRes = await this.runCommand(`LOGIN ${quoteImapAtom(email)} ${quoteImapAtom(password)}`);
        if (loginRes.ok) return { ok: true };
      } else if (hasAuthPlain) {
        // Handled below via AUTHENTICATE PLAIN for full UTF-8 password safety.
      } else {
        const loginRes = await this.runCommand(`LOGIN ${quoteImapAtom(email)} ${quoteImapAtom(password)}`);
        if (loginRes.ok) return { ok: true };
      }
    }

    if (hasAuthPlain) {
      const plainBytes = textEncoder.encode(`\x00${email}\x00${password}`);
      let bin = '';
      for (let i = 0; i < plainBytes.length; i += 1) bin += String.fromCharCode(plainBytes[i]);
      const b64 = btoa(bin);
      const plainRes = await this.runCommand(`AUTHENTICATE PLAIN ${b64}`);
      if (plainRes.ok) return { ok: true };
    }

    return {
      ok: false,
      status: 401,
      error: 'Login IMAP ditolak: Email atau Password / App Password tidak cocok.',
    };
  }

  async discoverFolders() {
    const res = await this.runCommand('LIST "" "*"');
    const discovered = [];

    for (const rec of res.untagged) {
      const m = rec.text.match(/^\*\s+LIST\s+\(([^)]*)\)\s+(?:"[^"]*"|NIL)\s+(.+)$/i);
      if (!m) continue;
      const flags = m[1] || '';
      if (/\\Noselect/i.test(flags)) continue;
      let rawName = m[2].trim();
      if (rawName.startsWith('"') && rawName.endsWith('"')) {
        rawName = rawName.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      if (rawName) {
        discovered.push({ name: rawName, flags });
      }
    }

    const findMailbox = (flagRegex, nameRegex, fallback = '') => {
      const byFlag = discovered.find((d) => flagRegex && flagRegex.test(d.flags));
      if (byFlag) return byFlag.name;
      const byName = discovered.find((d) => nameRegex.test(d.name));
      if (byName) return byName.name;
      return fallback;
    };

    const inboxName = findMailbox(null, /^inbox$/i, 'INBOX');
    const junkName = findMailbox(/\\(?:Junk|Spam)/i, /^(?:junk(?:\s*e-?mail)?|spam|bulk|\[gmail\]\/spam)$/i, '');
    const sentName = findMailbox(/\\Sent/i, /^(?:sent(?:\s*(?:items|mail|messages))?|\[gmail\]\/sent mail)$/i, '');
    const draftsName = findMailbox(/\\Drafts/i, /^(?:drafts?|\[gmail\]\/drafts)$/i, '');
    const trashName = findMailbox(/\\Trash/i, /^(?:deleted(?:\s*items)?|trash|bin|\[gmail\]\/trash)$/i, '');

    return {
      map: {
        inbox: inboxName,
        junkemail: junkName,
        sentitems: sentName,
        drafts: draftsName,
        deleteditems: trashName,
      },
      options: [
        { id: 'all_incoming', displayName: 'Semua Masuk (Inbox + Junk)', totalItemCount: 0, unreadItemCount: 0 },
        { id: 'inbox', displayName: 'Inbox', imapName: inboxName, totalItemCount: 0, unreadItemCount: 0 },
        ...(junkName
          ? [{ id: 'junkemail', displayName: 'Junk Email (Spam)', imapName: junkName, totalItemCount: 0, unreadItemCount: 0 }]
          : []),
        ...(sentName
          ? [{ id: 'sentitems', displayName: 'Sent Items', imapName: sentName, totalItemCount: 0, unreadItemCount: 0 }]
          : []),
        ...(draftsName
          ? [{ id: 'drafts', displayName: 'Drafts', imapName: draftsName, totalItemCount: 0, unreadItemCount: 0 }]
          : []),
        ...(trashName
          ? [{ id: 'deleteditems', displayName: 'Deleted Items', imapName: trashName, totalItemCount: 0, unreadItemCount: 0 }]
          : []),
      ],
    };
  }

  async fetchMailboxSummaries(mailboxName, folderTag = '', limit = 25, fallbackRecipient = '') {
    if (!mailboxName) return { exists: 0, messages: [] };
    const sel = await this.runCommand(`EXAMINE ${quoteImapAtom(mailboxName)}`);
    if (!sel.ok) return { exists: 0, messages: [] };

    let exists = 0;
    for (const rec of sel.untagged) {
      const m = rec.text.match(/^\*\s+(\d+)\s+EXISTS\b/i);
      if (m) exists = Number(m[1] || 0);
    }
    if (exists <= 0) return { exists: 0, messages: [] };

    const startSeq = Math.max(1, exists - Math.min(40, Math.max(5, limit)) + 1);
    const fetchRes = await this.runCommand(
      `FETCH ${startSeq}:${exists} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[]<0.32768>)`
    );
    if (!fetchRes.ok) return { exists, messages: [] };

    const parsedItems = [];
    for (const rec of fetchRes.untagged) {
      if (!/^\*\s+\d+\s+FETCH\b/i.test(rec.text)) continue;
      const uidMatch = rec.text.match(/\bUID\s+(\d+)\b/i);
      const seqMatch = rec.text.match(/^\*\s+(\d+)\s+FETCH\b/i);
      const uid = uidMatch ? uidMatch[1] : seqMatch ? seqMatch[1] : '';
      if (!uid) continue;

      const flagsMatch = rec.text.match(/\bFLAGS\s+\(([^)]*)\)/i);
      const flagsStr = flagsMatch ? flagsMatch[1] : '';
      const isRead = /\\Seen/i.test(flagsStr);

      const dateMatch = rec.text.match(/\bINTERNALDATE\s+"([^"]+)"/i);
      let receivedAt = dateMatch ? Date.parse(dateMatch[1]) || 0 : 0;

      const rawPartial = rec.literals[0];
      let subject = '(Tanpa Subjek)';
      let snippet = '';
      let fromName = '';
      let fromAddress = '';
      let recipient = fallbackRecipient;
      let hasAttachments = false;
      let otpCode = null;

      if (rawPartial && rawPartial.length > 0) {
        try {
          const mime = await PostalMime.parse(rawPartial);
          subject = String(mime.subject || '').trim() || '(Tanpa Subjek)';
          fromName = String(mime.from?.name || '').trim();
          fromAddress = String(mime.from?.address || '').trim();
          if (Array.isArray(mime.to) && mime.to[0]?.address) {
            recipient = mime.to[0].address;
          }
          if (!receivedAt && mime.date) {
            receivedAt = Date.parse(mime.date) || 0;
          }
          const textBody = String(mime.text || '');
          const htmlBody = String(mime.html || '');
          const plainSource = (textBody || stripHtmlSimple(htmlBody)).replace(/\s+/g, ' ').trim();
          snippet = plainSource.length > 180 ? `${plainSource.slice(0, 179).trim()}...` : plainSource;
          hasAttachments = Array.isArray(mime.attachments) && mime.attachments.some((a) => !a.contentId);
          otpCode = extractOtpCode(subject, textBody, htmlBody, false);
        } catch {
          // Fallback if partial MIME was truncated mid-boundary.
          const rawTxt = textDecoder.decode(rawPartial);
          const subjHdr = rawTxt.match(/^Subject:\s*(.+)$/im);
          if (subjHdr) subject = subjHdr[1].trim();
          otpCode = extractOtpCode(subject, rawTxt.slice(0, 2000), '', false);
        }
      }

      if (!receivedAt) receivedAt = Date.now();

      parsedItems.push({
        id: makeImapMessageId(mailboxName, uid),
        subject,
        snippet,
        fromName: fromName || fromAddress || 'Email Sender',
        fromAddress,
        sender: fromAddress || fromName || 'unknown',
        recipient: recipient || fallbackRecipient,
        receivedAt,
        isRead,
        hasAttachments,
        otpCode: otpCode || null,
        folderTag: folderTag || '',
      });
    }

    parsedItems.sort((a, b) => b.receivedAt - a.receivedAt);
    return { exists, messages: parsedItems };
  }

  async fetchFullMessageByUid(mailboxName, uid, fallbackRecipient = '') {
    const sel = await this.runCommand(`EXAMINE ${quoteImapAtom(mailboxName)}`);
    if (!sel.ok) {
      return { ok: false, status: 404, error: `Folder IMAP ${mailboxName} tidak ditemukan.` };
    }

    const fetchRes = await this.runCommand(`UID FETCH ${uid} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[])`);
    const rec = fetchRes.untagged.find((r) => /^\*\s+\d+\s+FETCH\b/i.test(r.text) && r.literals.length > 0);
    if (!fetchRes.ok || !rec || !rec.literals[0]) {
      return { ok: false, status: 404, error: 'Isi pesan email tidak ditemukan di server IMAP.' };
    }

    const dateMatch = rec.text.match(/\bINTERNALDATE\s+"([^"]+)"/i);
    const parsed = await parseIncomingEmail({
      raw: rec.literals[0],
      envelopeTo: fallbackRecipient,
    });
    const receivedAt = (dateMatch && Date.parse(dateMatch[1])) || parsed.receivedAt || Date.now();

    return {
      ok: true,
      email: {
        id: makeImapMessageId(mailboxName, uid),
        subject: parsed.subject,
        fromName: parsed.fromName || parsed.fromAddress || 'Email Sender',
        fromAddress: parsed.fromAddress,
        sender: parsed.sender,
        recipient: parsed.headerTo || parsed.recipient || fallbackRecipient || '-',
        receivedAt,
        sizeBytes: parsed.sizeBytes,
        otpCode: parsed.otpCode || null,
        htmlBody: parsed.htmlBody,
        textBody: parsed.textBody,
        headers: parsed.headers,
        attachments: (parsed.attachments || []).map((att) => ({
          id: att.id,
          filename: att.filename,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          dataUrl: att.contentBase64 ? `data:${att.mimeType};base64,${att.contentBase64}` : null,
        })),
      },
    };
  }

  async close() {
    try {
      await this.writeRaw('A999 LOGOUT\r\n');
    } catch {}
    try {
      this.reader.releaseLock();
    } catch {}
    try {
      this.writer.releaseLock();
    } catch {}
    try {
      this.socket.close();
    } catch {}
  }
}

export function resolveImapTargets(email = '', explicitHost = '', explicitPort = 993) {
  const safePort = Number(explicitPort || 993) || 993;
  if (explicitHost) {
    return [{ host: explicitHost, port: safePort }];
  }
  const domain = getEmailDomain(email);
  if (!domain) return [{ host: 'outlook.office365.com', port: 993 }];

  if (MS_CONSUMER_DOMAIN_REGEX.test(domain) || /\.onmicrosoft\.com$/i.test(domain) || /^office365\./i.test(domain)) {
    return [{ host: 'outlook.office365.com', port: 993 }];
  }

  for (const entry of NON_MS_KNOWN_IMAP_HOSTS) {
    if (entry.test.test(domain)) {
      return [{ host: entry.host, port: entry.port, provider: entry.provider }];
    }
  }

  return [
    { host: `imap.${domain}`, port: 993 },
    { host: `mail.${domain}`, port: 993 },
    { host: 'outlook.office365.com', port: 993 },
  ];
}

export async function connectImapMailbox({
  authType = 'password',
  email = '',
  password = '',
  accessToken = '',
  imapHost = '',
  imapPort = 993,
  folder = 'all_incoming',
  top = 30,
  socketFactory = null,
} = {}) {
  const targets = resolveImapTargets(email, imapHost, imapPort);
  let lastError = 'Gagal terhubung ke server IMAP email.';
  let lastStatus = 401;
  let sawLoginDisabled = false;

  for (const target of targets) {
    let session = null;
    try {
      const sock = await openTlsSocket({ host: target.host, port: target.port, socketFactory });
      session = new ImapTlsSession(sock);

      const authRes = await session.connectAndAuthenticate({
        authType,
        email,
        password,
        accessToken,
      });

      if (!authRes.ok) {
        if (authRes.loginDisabled) sawLoginDisabled = true;
        lastError = authRes.error || lastError;
        lastStatus = authRes.status || 401;
        await session.close();
        // If authentication explicitly failed on an explicit/known provider host, don't try unrelated hosts.
        if (imapHost || target.provider || authType === 'xoauth2') {
          break;
        }
        continue;
      }

      const discovered = await session.discoverFolders();
      const folderMap = discovered.map;
      let messages = [];
      let inboxTotal = 0;
      let junkTotal = 0;

      if (folder === 'all_incoming') {
        const inboxRes = await session.fetchMailboxSummaries(folderMap.inbox || 'INBOX', 'Inbox', top, email);
        inboxTotal = inboxRes.exists;
        let junkMessages = [];
        if (folderMap.junkemail) {
          const junkRes = await session.fetchMailboxSummaries(folderMap.junkemail, 'Junk', 20, email);
          junkTotal = junkRes.exists;
          junkMessages = junkRes.messages;
        }
        messages = [...inboxRes.messages, ...junkMessages]
          .sort((a, b) => b.receivedAt - a.receivedAt)
          .slice(0, top);
      } else {
        const targetMailbox = folderMap[folder] || folder;
        const singleRes = await session.fetchMailboxSummaries(targetMailbox, '', top, email);
        inboxTotal = singleRes.exists;
        messages = singleRes.messages;
      }

      const folders = discovered.options.map((opt) => {
        if (opt.id === 'all_incoming') {
          return { ...opt, totalItemCount: inboxTotal + junkTotal };
        }
        if (opt.id === 'inbox') {
          return { ...opt, totalItemCount: inboxTotal };
        }
        if (opt.id === 'junkemail') {
          return { ...opt, totalItemCount: junkTotal };
        }
        return opt;
      });

      await session.close();
      return {
        ok: true,
        transport: authType === 'xoauth2' ? 'imap-xoauth2' : 'imap-password',
        imapHost: target.host,
        imapPort: target.port,
        email,
        displayName: email,
        folders,
        folder: folder || 'all_incoming',
        messages,
      };
    } catch (err) {
      lastError = err?.message || lastError;
      lastStatus = 502;
      if (session) {
        await session.close();
      }
    }
  }

  return {
    ok: false,
    loginDisabled: sawLoginDisabled,
    status: lastStatus,
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

function buildMockMicrosoftData(emailHint = DEMO_MS_EMAIL) {
  const addr = emailHint || DEMO_MS_EMAIL;
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
      htmlBody: `<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:24px;color:#0f172a;"><h2 style="margin:0 0 12px;color:#0284c7;">Kode Keamanan Akun Microsoft</h2><p>Gunakan kode verifikasi berikut untuk menyelesaikan proses autentikasi:</p><div style="display:inline-block;padding:12px 20px;border-radius:12px;background:#e0f2fe;color:#075985;font-size:24px;font-weight:800;letter-spacing:4px;">849204</div><p style="margin-top:16px;color:#475569;font-size:13px;">Pesan diterima melalui AMC Microsoft Mail Reader.</p></div>`,
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
      snippet: 'Kotak masuk Outlook dan Hotmail Anda berhasil terhubung hanya dengan Email & Password.',
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

function isMockSessionRequest(allowMock, { clientId = '', email = '', password = '', transport = '' } = {}) {
  if (!allowMock) return false;
  if (clientId === DEMO_MS_CLIENT_ID || transport === 'mock') return true;
  if (String(email || '').trim().toLowerCase() === DEMO_MS_EMAIL && password === 'demo-amc') return true;
  return false;
}

async function openMailboxWithOAuthToken({
  accessToken,
  refreshToken = '',
  clientId = '',
  emailHint = '',
  folder = 'all_incoming',
  fetchImpl = fetch,
  socketFactory = null,
}) {
  const [meRes, foldersRes, msgsResult] = await Promise.all([
    graphGet('/me?$select=displayName,mail,userPrincipalName', accessToken, fetchImpl),
    graphGet(
      '/me/mailFolders?$top=25&$select=id,displayName,totalItemCount,unreadItemCount',
      accessToken,
      fetchImpl
    ),
    listMicrosoftMessagesInternal({
      accessToken,
      folder: folder || 'all_incoming',
      top: 35,
      fetchImpl,
    }),
  ]);

  if (msgsResult.ok) {
    const resolvedEmail =
      String(meRes.data?.mail || meRes.data?.userPrincipalName || emailHint || msgsResult.messages[0]?.recipient || '')
        .trim()
        .toLowerCase();
    const displayName = String(meRes.data?.displayName || resolvedEmail || 'Microsoft Mailbox').trim();
    const rawFolders = Array.isArray(foldersRes.data?.value) ? foldersRes.data.value : [];
    const folders = buildFolderOptions(rawFolders, msgsResult.messages.length);

    return {
      ok: true,
      transport: 'graph',
      email: resolvedEmail || 'Terhubung ke Microsoft',
      displayName,
      clientId,
      accessToken,
      refreshToken,
      expiresIn: 3600,
      folders,
      folder: folder || 'all_incoming',
      messages: msgsResult.messages,
    };
  }

  // Automatic fallback: tokens with IMAP.AccessAsUser.All (e.g. Thunderbird) work via IMAPS XOAUTH2!
  const imapEmail = (emailHint || extractEmailFromTokenClaims(accessToken)).trim().toLowerCase();
  if (imapEmail) {
    const imapRes = await connectImapMailbox({
      authType: 'xoauth2',
      email: imapEmail,
      accessToken,
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      folder: folder || 'all_incoming',
      top: 35,
      socketFactory,
    });
    if (imapRes.ok) {
      return {
        ...imapRes,
        clientId,
        accessToken,
        refreshToken,
        expiresIn: 3600,
      };
    }
  }

  return {
    ok: false,
    status: msgsResult.status || 403,
    error: msgsResult.error || 'Token berhasil ditukar tetapi tidak memiliki izin membaca pesan.',
    code: 'GRAPH_MAIL_DENIED',
  };
}

export async function connectMicrosoftMailbox({
  combo = '',
  email = '',
  password = '',
  refreshToken = '',
  clientId = '',
  imapHost = '',
  imapPort = 993,
  folder = 'all_incoming',
  allowMock = false,
  fetchImpl = fetch,
  socketFactory = null,
} = {}) {
  const parsed = parseMicrosoftCombo(combo, {
    email,
    password,
    refreshToken,
    clientId,
    imapHost,
    imapPort,
  });

  if (!parsed.valid) {
    return { ok: false, status: 400, error: parsed.error, code: 'INVALID_COMBO' };
  }

  if (
    isMockSessionRequest(allowMock, {
      clientId: parsed.clientId,
      email: parsed.email,
      password: parsed.password,
    })
  ) {
    const mock = buildMockMicrosoftData(parsed.email || DEMO_MS_EMAIL);
    return {
      ok: true,
      transport: 'mock',
      email: mock.email,
      displayName: mock.displayName,
      clientId: parsed.clientId || DEMO_MS_CLIENT_ID,
      accessToken: 'mock-ms-access-token',
      refreshToken: parsed.refreshToken || 'mock-ms-refresh-token',
      expiresIn: 3600,
      folders: mock.folders,
      folder: folder || 'all_incoming',
      messages: mock.messages.map(({ htmlBody, textBody, ...summary }) => summary),
    };
  }

  // Strategy 1: OAuth Refresh Token (if present in combo or advanced input)
  let oauthError = null;
  if (parsed.refreshToken) {
    const tokenRes = await refreshMicrosoftAccessToken({
      refreshToken: parsed.refreshToken,
      clientId: parsed.clientId,
      fetchImpl,
    });

    if (tokenRes.ok) {
      const opened = await openMailboxWithOAuthToken({
        accessToken: tokenRes.accessToken,
        refreshToken: tokenRes.refreshToken,
        clientId: tokenRes.clientId || parsed.clientId,
        emailHint: parsed.email || tokenRes.email,
        folder,
        fetchImpl,
        socketFactory,
      });
      if (opened.ok) return opened;
      oauthError = opened;
    } else {
      oauthError = tokenRes;
    }

    if (!parsed.password) {
      return {
        ok: false,
        status: oauthError?.status || 401,
        error: oauthError?.error || 'Gagal menghubungkan Refresh Token Microsoft.',
        code: 'OAUTH_FAILED',
      };
    }
  }

  // Strategy 2 & 3: Email + Password flow
  if (parsed.email && parsed.password) {
    // Explicit custom IMAP host takes direct priority when configured.
    if (parsed.imapHost) {
      const directImap = await connectImapMailbox({
        authType: 'password',
        email: parsed.email,
        password: parsed.password,
        imapHost: parsed.imapHost,
        imapPort: parsed.imapPort,
        folder,
        top: 35,
        socketFactory,
      });
      if (directImap.ok) return directImap;
      return {
        ok: false,
        status: directImap.status || 401,
        error: directImap.error,
        code: 'IMAP_AUTH_FAILED',
      };
    }

    // Personal @outlook / @hotmail / @live / @msn accounts: Microsoft enforces Modern Auth.
    // If custom socketFactory is injected (local test), test IMAPS first; otherwise launch 1-click Device Auth!
    if (isConsumerMicrosoftEmail(parsed.email) && !socketFactory) {
      const deviceAuth = await startMicrosoftDeviceAuth({ email: parsed.email, fetchImpl });
      if (deviceAuth.ok) {
        return {
          ok: true,
          requiresDeviceAuth: true,
          code: 'MS_MODERN_AUTH_REQUIRED',
          email: parsed.email,
          message: `Akun personal ${parsed.email} menggunakan proteksi Modern Auth Microsoft. Klik tombol di bawah untuk login cepat dengan email & sandi Anda di halaman resmi Microsoft — kotak masuk akan terbuka otomatis.`,
          deviceAuth,
        };
      }
    }

    const domain = getEmailDomain(parsed.email);
    const isKnownNonMsImap = NON_MS_KNOWN_IMAP_HOSTS.some((entry) => entry.test.test(domain));

    // Try Microsoft Entra / M365 ROPC (grant_type=password) first for Microsoft & custom domains.
    if (!isKnownNonMsImap && !isConsumerMicrosoftEmail(parsed.email)) {
      const ropcRes = await authenticateMicrosoftPasswordROPC({
        email: parsed.email,
        password: parsed.password,
        clientId: parsed.clientId,
        fetchImpl,
      });

      if (ropcRes.ok) {
        const opened = await openMailboxWithOAuthToken({
          accessToken: ropcRes.accessToken,
          refreshToken: ropcRes.refreshToken,
          clientId: ropcRes.clientId,
          emailHint: ropcRes.email || parsed.email,
          folder,
          fetchImpl,
          socketFactory,
        });
        if (opened.ok) return opened;
      } else if (ropcRes.reason === 'invalid_credentials' || ropcRes.reason === 'account_locked') {
        return {
          ok: false,
          status: ropcRes.status || 401,
          error: ropcRes.error,
          code: 'MS_INVALID_PASSWORD',
        };
      } else if (ropcRes.reason === 'requires_mfa') {
        const deviceAuth = await startMicrosoftDeviceAuth({ email: parsed.email, fetchImpl });
        if (deviceAuth.ok) {
          return {
            ok: true,
            requiresDeviceAuth: true,
            code: 'MS_MFA_REQUIRED',
            email: parsed.email,
            message: `Akun ${parsed.email} memerlukan konfirmasi login Microsoft (MFA / Modern Auth). Selesaikan login satu klik melalui kode di bawah untuk membuka inbox.`,
            deviceAuth,
          };
        }
      }
    }

    // Try Direct IMAPS over TLS 993 (works for App Passwords, Gmail/Yahoo/iCloud/Zoho, & custom domain IMAP!)
    const imapRes = await connectImapMailbox({
      authType: 'password',
      email: parsed.email,
      password: parsed.password,
      imapHost: parsed.imapHost,
      imapPort: parsed.imapPort,
      folder,
      top: 35,
      socketFactory,
    });

    if (imapRes.ok) {
      return imapRes;
    }

    if (imapRes.loginDisabled) {
      const deviceAuth = await startMicrosoftDeviceAuth({ email: parsed.email, fetchImpl });
      if (deviceAuth.ok) {
        return {
          ok: true,
          requiresDeviceAuth: true,
          code: 'MS_MODERN_AUTH_REQUIRED',
          email: parsed.email,
          message: `Server email untuk ${parsed.email} mewajibkan Modern Auth Microsoft. Klik tombol di bawah untuk login langsung dengan email & sandi Anda.`,
          deviceAuth,
        };
      }
    }

    const hint = isKnownNonMsImap
      ? ' Jika akun menggunakan verifikasi 2 langkah, gunakan App Password pada kolom Password.'
      : '';
    return {
      ok: false,
      status: imapRes.status || 401,
      error: `${imapRes.error}${hint}`,
      code: 'AUTH_FAILED',
    };
  }

  return {
    ok: false,
    status: 400,
    error: 'Kredensial email tidak lengkap.',
    code: 'INVALID_COMBO',
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
  transport = 'graph',
  accessToken = '',
  refreshToken = '',
  clientId = '',
  email = '',
  password = '',
  imapHost = '',
  imapPort = 993,
  folder = 'all_incoming',
  top = 35,
  allowMock = false,
  fetchImpl = fetch,
  socketFactory = null,
} = {}) {
  if (isMockSessionRequest(allowMock, { clientId, email, password, transport })) {
    const mock = buildMockMicrosoftData(email);
    let filtered = mock.messages;
    if (folder === 'inbox') filtered = mock.messages.filter((m) => m.folderTag === 'Inbox');
    else if (folder === 'junkemail') filtered = mock.messages.filter((m) => m.folderTag === 'Junk');
    else if (folder !== 'all_incoming') filtered = [];
    return {
      ok: true,
      transport: 'mock',
      accessToken: 'mock-ms-access-token',
      refreshToken,
      messages: filtered.map(({ htmlBody, textBody, ...s }) => s),
    };
  }

  if (transport === 'imap-password' || (!accessToken && !refreshToken && email && password)) {
    const imapRes = await connectImapMailbox({
      authType: 'password',
      email,
      password,
      imapHost,
      imapPort,
      folder,
      top,
      socketFactory,
    });
    if (!imapRes.ok) return imapRes;
    return {
      ok: true,
      transport: 'imap-password',
      messages: imapRes.messages,
    };
  }

  let tokenToUse = String(accessToken || '').trim();
  let nextRefresh = String(refreshToken || '').trim();
  let resolvedClientId = String(clientId || '').trim();

  if (!tokenToUse) {
    if (!nextRefresh) {
      return { ok: false, status: 400, error: 'Kredensial sesi Microsoft tidak lengkap.' };
    }
    const refreshed = await refreshMicrosoftAccessToken({
      refreshToken: nextRefresh,
      clientId: resolvedClientId,
      fetchImpl,
    });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
    resolvedClientId = refreshed.clientId || resolvedClientId;
  }

  if (transport === 'imap-xoauth2') {
    let imapRes = await connectImapMailbox({
      authType: 'xoauth2',
      email,
      accessToken: tokenToUse,
      imapHost: imapHost || 'outlook.office365.com',
      imapPort: imapPort || 993,
      folder,
      top,
      socketFactory,
    });
    if (!imapRes.ok && nextRefresh) {
      const refreshed = await refreshMicrosoftAccessToken({
        refreshToken: nextRefresh,
        clientId: resolvedClientId,
        fetchImpl,
      });
      if (!refreshed.ok) return refreshed;
      tokenToUse = refreshed.accessToken;
      nextRefresh = refreshed.refreshToken;
      imapRes = await connectImapMailbox({
        authType: 'xoauth2',
        email,
        accessToken: tokenToUse,
        imapHost: imapHost || 'outlook.office365.com',
        imapPort: imapPort || 993,
        folder,
        top,
        socketFactory,
      });
    }
    if (!imapRes.ok) return imapRes;
    return {
      ok: true,
      transport: 'imap-xoauth2',
      accessToken: tokenToUse,
      refreshToken: nextRefresh,
      messages: imapRes.messages,
    };
  }

  let res = await listMicrosoftMessagesInternal({ accessToken: tokenToUse, folder, top, fetchImpl });
  if (!res.ok && res.status === 401 && nextRefresh) {
    const refreshed = await refreshMicrosoftAccessToken({
      refreshToken: nextRefresh,
      clientId: resolvedClientId,
      fetchImpl,
    });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
    res = await listMicrosoftMessagesInternal({ accessToken: tokenToUse, folder, top, fetchImpl });
  }

  if (!res.ok) return res;
  return {
    ok: true,
    transport: 'graph',
    accessToken: tokenToUse,
    refreshToken: nextRefresh,
    messages: res.messages,
  };
}

export async function getMicrosoftMessageDetail({
  transport = 'graph',
  accessToken = '',
  refreshToken = '',
  clientId = '',
  email = '',
  password = '',
  imapHost = '',
  imapPort = 993,
  messageId = '',
  allowMock = false,
  fetchImpl = fetch,
  socketFactory = null,
} = {}) {
  if (!messageId) {
    return { ok: false, status: 400, error: 'ID pesan email diperlukan.' };
  }

  if (isMockSessionRequest(allowMock, { clientId, email, password, transport })) {
    const mock = buildMockMicrosoftData(email);
    const found = mock.messages.find((m) => m.id === messageId) || mock.messages[0];
    return {
      ok: true,
      transport: 'mock',
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

  const imapId = parseImapMessageId(messageId);
  if (imapId || transport === 'imap-password' || transport === 'imap-xoauth2') {
    const targetMailbox = imapId?.mailbox || 'INBOX';
    const targetUid = imapId?.uid || messageId;
    const isOauthImap = transport === 'imap-xoauth2' || Boolean((accessToken || refreshToken) && !password);

    let tokenToUse = String(accessToken || '').trim();
    let nextRefresh = String(refreshToken || '').trim();

    if (isOauthImap && !tokenToUse && nextRefresh) {
      const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
      if (!refreshed.ok) return refreshed;
      tokenToUse = refreshed.accessToken;
      nextRefresh = refreshed.refreshToken;
    }

    const targets = resolveImapTargets(email, imapHost, imapPort);
    const hostToUse = targets[0]?.host || 'outlook.office365.com';
    const portToUse = targets[0]?.port || 993;

    const fetchViaImap = async (tok) => {
      let session = null;
      try {
        const sock = await openTlsSocket({ host: hostToUse, port: portToUse, socketFactory });
        session = new ImapTlsSession(sock);
        const authRes = await session.connectAndAuthenticate({
          authType: isOauthImap ? 'xoauth2' : 'password',
          email,
          password,
          accessToken: tok,
        });
        if (!authRes.ok) {
          await session.close();
          return authRes;
        }
        const detail = await session.fetchFullMessageByUid(targetMailbox, targetUid, email);
        await session.close();
        return detail;
      } catch (err) {
        if (session) await session.close();
        return { ok: false, status: 502, error: err?.message || 'Gagal mengambil isi pesan IMAP.' };
      }
    };

    let detailRes = await fetchViaImap(tokenToUse);
    if (!detailRes.ok && isOauthImap && nextRefresh) {
      const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
      if (refreshed.ok) {
        tokenToUse = refreshed.accessToken;
        nextRefresh = refreshed.refreshToken;
        detailRes = await fetchViaImap(tokenToUse);
      }
    }

    if (!detailRes.ok) return detailRes;
    return {
      ok: true,
      transport: isOauthImap ? 'imap-xoauth2' : 'imap-password',
      accessToken: tokenToUse,
      refreshToken: nextRefresh,
      email: detailRes.email,
    };
  }

  let tokenToUse = String(accessToken || '').trim();
  let nextRefresh = String(refreshToken || '').trim();

  if (!tokenToUse && nextRefresh) {
    const refreshed = await refreshMicrosoftAccessToken({ refreshToken: nextRefresh, clientId, fetchImpl });
    if (!refreshed.ok) return refreshed;
    tokenToUse = refreshed.accessToken;
    nextRefresh = refreshed.refreshToken;
  }

  const select =
    'id,subject,body,bodyPreview,from,sender,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,internetMessageHeaders';
  const safeId = encodeURIComponent(messageId);

  let msgRes = await graphGet(`/me/messages/${safeId}?$select=${select}`, tokenToUse, fetchImpl);
  if (!msgRes.ok && msgRes.status === 401 && nextRefresh) {
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
    transport: 'graph',
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
