const DEFAULT_DEV_PIN = 'amc2026';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Hash both inputs before XOR comparison so length differences do not leak timing.
export async function constantTimeEqual(a, b) {
  const hashA = new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(String(a))));
  const hashB = new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(String(b))));
  let diff = 0;
  for (let i = 0; i < hashA.length; i++) {
    diff |= hashA[i] ^ hashB[i];
  }
  return diff === 0;
}

export function getAdminConfig(env) {
  const pin = (env?.ADMIN_PIN || '').trim() || DEFAULT_DEV_PIN;
  const isDefaultPin = !(env?.ADMIN_PIN || '').trim() || pin === DEFAULT_DEV_PIN;
  const secret = (env?.AUTH_SECRET || '').trim() || `amc-fallback-hmac:${pin}`;
  return { pin, secret, isDefaultPin };
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function verifyAdminPin(candidatePin, env) {
  const { pin, isDefaultPin } = getAdminConfig(env);
  const valid = await constantTimeEqual(String(candidatePin || '').trim(), pin);
  return { valid, isDefaultPin };
}

export async function createAdminToken(env) {
  const { secret } = getAdminConfig(env);
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const payload = {
    role: 'admin',
    iat: now,
    exp: expiresAt,
    nonce: crypto.randomUUID(),
  };
  const payloadB64 = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return {
    token: `${payloadB64}.${sigB64}`,
    expiresAt,
  };
}

export async function verifyAdminToken(token, env) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return false;

  try {
    const { secret } = getAdminConfig(env);
    const key = await getHmacKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    const validSig = await crypto.subtle.verify('HMAC', key, sigBytes, textEncoder.encode(payloadB64));
    if (!validSig) return false;

    const payload = JSON.parse(textDecoder.decode(fromBase64Url(payloadB64)));
    if (payload.role !== 'admin') return false;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)amc_admin_token=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return '';
}

export async function isAdminRequest(request, env) {
  const token = extractBearerToken(request);
  return verifyAdminToken(token, env);
}
