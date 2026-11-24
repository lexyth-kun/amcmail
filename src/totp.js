const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function cleanBase32Secret(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[\s\-=]+/g, '');
}

export function base32ToBytes(rawSecret) {
  const cleaned = cleanBase32Secret(rawSecret);
  if (!cleaned) {
    throw new Error('Setup key 2FA masih kosong.');
  }
  if (cleaned.length < 8) {
    throw new Error('Setup key 2FA terlalu pendek. Masukkan minimal 8 karakter Base32.');
  }

  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Karakter "${cleaned[i]}" tidak valid untuk format Base32 (gunakan A-Z dan 2-7).`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

export function parseTotpInput(rawInput, fallbackLabel = '') {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Masukkan setup key Base32 atau tautan otpauth:// terlebih dahulu.' };
  }

  let secret = '';
  let label = String(fallbackLabel || '').trim();
  let digits = 6;
  let period = 30;
  let algorithm = 'SHA-1';

  if (/^otpauth:\/\//i.test(trimmed)) {
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.protocol.toLowerCase() !== 'otpauth:') {
        return { valid: false, error: 'Skema tautan 2FA tidak dikenali.' };
      }
      const hostType = parsedUrl.hostname.toLowerCase();
      if (hostType && hostType !== 'totp') {
        return { valid: false, error: 'Hanya format TOTP (otpauth://totp/...) yang didukung.' };
      }
      secret = cleanBase32Secret(parsedUrl.searchParams.get('secret') || '');
      const pathLabel = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')).trim();
      const issuer = (parsedUrl.searchParams.get('issuer') || '').trim();
      if (!label) {
        if (pathLabel) {
          label = issuer && !pathLabel.toLowerCase().startsWith(issuer.toLowerCase())
            ? `${issuer} (${pathLabel})`
            : pathLabel;
        } else if (issuer) {
          label = issuer;
        }
      }

      const rawDigits = Number(parsedUrl.searchParams.get('digits') || 6);
      if (rawDigits === 6 || rawDigits === 8) digits = rawDigits;

      const rawPeriod = Number(parsedUrl.searchParams.get('period') || 30);
      if (rawPeriod >= 10 && rawPeriod <= 120) period = Math.round(rawPeriod);

      const rawAlgo = String(parsedUrl.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
      if (rawAlgo === 'SHA256') algorithm = 'SHA-256';
      else if (rawAlgo === 'SHA512') algorithm = 'SHA-512';
      else algorithm = 'SHA-1';
    } catch {
      return { valid: false, error: 'Format tautan otpauth:// tidak valid.' };
    }
  } else {
    secret = cleanBase32Secret(trimmed);
  }

  try {
    base32ToBytes(secret);
  } catch (err) {
    return { valid: false, error: err.message };
  }

  return {
    valid: true,
    secret,
    label: label.slice(0, 120),
    digits,
    period,
    algorithm,
  };
}

export async function generateTotpCode(
  secretBase32,
  { timestampMs = Date.now(), period = 30, digits = 6, algorithm = 'SHA-1' } = {}
) {
  const keyBytes = base32ToBytes(secretBase32);
  const epochSeconds = Math.floor(timestampMs / 1000);
  const counter = Math.floor(epochSeconds / period);

  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  const otp = String(binary % mod).padStart(digits, '0');
  return {
    code: otp,
    counter,
    digits,
    period,
  };
}
