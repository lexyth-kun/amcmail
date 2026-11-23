import PostalMime from 'postal-mime';

// Keep raw MIME and inline attachments within Cloudflare D1 row size limits.
const MAX_RAW_SOURCE_CHARS = 512 * 1024;
const MAX_INLINE_ATTACHMENT_BYTES = 1_500_000;

const textDecoder = new TextDecoder('utf-8', { fatal: false });

function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function decodeContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content instanceof ArrayBuffer) return textDecoder.decode(new Uint8Array(content));
  if (ArrayBuffer.isView(content)) return textDecoder.decode(content);
  return String(content);
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSnippet(text, html, maxLen = 180) {
  const source = (text || stripHtml(html) || '').replace(/\s+/g, ' ').trim();
  if (source.length <= maxLen) return source;
  return `${source.slice(0, maxLen - 1).trim()}...`;
}

function getHeaderValue(headers, name) {
  const target = name.toLowerCase();
  const found = (headers || []).find((h) => String(h.key || '').toLowerCase() === target);
  return found ? String(found.value || '').trim() : '';
}

function getAllHeaderValues(headers, name) {
  const target = name.toLowerCase();
  return (headers || [])
    .filter((h) => String(h.key || '').toLowerCase() === target)
    .map((h) => String(h.value || '').trim())
    .filter(Boolean);
}

// RFC 3464 DSN fields may wrap across lines prefixed with whitespace.
function parseDsnFields(rawDsn) {
  const fields = {};
  if (!rawDsn) return fields;
  const lines = rawDsn.replace(/\r\n/g, '\n').split('\n');
  let lastKey = null;
  for (const line of lines) {
    if (!line.trim()) {
      lastKey = null;
      continue;
    }
    if (/^[ \t]+/.test(line) && lastKey) {
      fields[lastKey] = `${fields[lastKey]} ${line.trim()}`;
      continue;
    }
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (!fields[key]) {
        fields[key] = val;
      }
      lastKey = key;
    }
  }
  return fields;
}

function cleanDsnTypePrefix(val) {
  if (!val) return '';
  return val.replace(/^(?:rfc822|dns|smtp|x-unix|x-postfix)\s*;\s*/i, '').trim();
}

function parseOriginalRfc822(rawOriginal) {
  if (!rawOriginal) return { originalSubject: '', originalMessageId: '', originalTo: '' };
  const normalized = rawOriginal.replace(/\r\n/g, '\n');
  const headerPart = normalized.split('\n\n')[0] || normalized;
  const fields = parseDsnFields(headerPart);
  return {
    originalSubject: fields['subject'] || '',
    originalMessageId: fields['message-id'] || '',
    originalTo: fields['to'] || '',
  };
}

export function parseAuthResults(headers) {
  const authHeaders = getAllHeaderValues(headers, 'authentication-results').join(' ; ');
  const spfHeader = getHeaderValue(headers, 'received-spf');

  const extractResult = (pattern, src) => {
    const m = src.match(pattern);
    return m ? m[1].toLowerCase() : null;
  };

  let spf = extractResult(/\bspf=(pass|fail|softfail|neutral|none|temperror|permerror)\b/i, authHeaders);
  if (!spf && spfHeader) {
    spf = extractResult(/^(pass|fail|softfail|neutral|none|temperror|permerror)\b/i, spfHeader);
  }
  const dkim = extractResult(/\bdkim=(pass|fail|neutral|none|temperror|permerror|policy)\b/i, authHeaders);
  const dmarc = extractResult(/\bdmarc=(pass|fail|bestguesspass|none|temperror|permerror)\b/i, authHeaders);

  if (!spf && !dkim && !dmarc) return null;
  return { spf, dkim, dmarc };
}

export function analyzeBounce({ envelopeFrom, fromAddress, fromName, subject, headers, textBody, htmlBody, attachments }) {
  const contentType = getHeaderValue(headers, 'content-type').toLowerCase();
  const autoSubmitted = getHeaderValue(headers, 'auto-submitted').toLowerCase();
  const failedRecipientsHeader = getHeaderValue(headers, 'x-failed-recipients');
  const returnPath = getHeaderValue(headers, 'return-path').trim();

  const envFromNorm = String(envelopeFrom || '').trim().toLowerCase();
  const headerFromNorm = String(fromAddress || '').trim().toLowerCase();
  const fromNameNorm = String(fromName || '').trim().toLowerCase();
  const subjectNorm = String(subject || '').trim().toLowerCase();

  let rawDsn = '';
  let rawOriginal = '';
  for (const att of attachments || []) {
    const mime = String(att.mimeType || '').toLowerCase();
    if (mime === 'message/delivery-status' || mime === 'message/global-delivery-status') {
      rawDsn = decodeContent(att.content);
    } else if (
      mime === 'message/rfc822' ||
      mime === 'text/rfc822-headers' ||
      mime === 'message/global' ||
      mime === 'message/global-headers'
    ) {
      rawOriginal = decodeContent(att.content);
    }
  }

  const hasDeliveryStatusMime =
    Boolean(rawDsn) ||
    (contentType.includes('multipart/report') && contentType.includes('delivery-status'));

  // RFC 5321 requires DSN bounces to use an empty reverse-path (<>).
  const isNullSender =
    envFromNorm === '' ||
    envFromNorm === '<>' ||
    returnPath === '<>' ||
    returnPath === '';

  const isDaemonSender =
    /(?:^|<)(?:mailer-daemon|postmaster|mail-delivery|bounce|bounces|mdaemon|nobody|returned-mail)/i.test(
      headerFromNorm || envFromNorm
    ) ||
    /(?:mail delivery subsystem|mail delivery system|delivery subsystem|postmaster|mailer-daemon)/i.test(
      fromNameNorm
    );

  const hasBounceSubject =
    /(?:delivery status notification|undelivered mail|returned to sender|mail delivery failed|failure notice|undeliverable|delivery failure|address not found|message blocked|delivery incomplete|returned mail|delivery delayed|permanent error|bounced|delivery problem|couldn't be delivered|could not be delivered|gagal terkirim)/i.test(
      subjectNorm
    );

  const hasFailedHeader = Boolean(failedRecipientsHeader);
  const hasAutoReplied = autoSubmitted.includes('auto-replied') || autoSubmitted.includes('auto-generated');

  const combinedText = `${textBody || ''}\n${stripHtml(htmlBody || '')}`;
  const hasSmtpFailureInBody =
    /\b(?:550|551|552|553|554|421|450|451|452)\s+(?:[45]\.\d+\.\d+|5\d\d|4\d\d|user unknown|mailbox|does not exist|blocked|rejected|quota|deferred)/i.test(
      combinedText
    );

  const isBounce =
    hasDeliveryStatusMime ||
    hasFailedHeader ||
    (isDaemonSender && (hasBounceSubject || hasSmtpFailureInBody || hasAutoReplied || isNullSender)) ||
    (isNullSender && (hasBounceSubject || hasSmtpFailureInBody)) ||
    (hasBounceSubject && hasSmtpFailureInBody);

  if (!isBounce) {
    return { isBounce: false, bounceInfo: null };
  }

  const dsn = parseDsnFields(rawDsn);
  const orig = parseOriginalRfc822(rawOriginal);

  const action =
    (dsn['action'] || '').toLowerCase() ||
    (hasBounceSubject && /delay|warning|incomplete/.test(subjectNorm) ? 'delayed' : 'failed');
  let enhancedStatus = (dsn['status'] || '').trim();
  let diagnostic = cleanDsnTypePrefix(dsn['diagnostic-code'] || '');
  let finalRecipient =
    cleanDsnTypePrefix(dsn['final-recipient'] || '') ||
    cleanDsnTypePrefix(dsn['original-recipient'] || '') ||
    failedRecipientsHeader ||
    orig.originalTo ||
    '';
  const reportingMta = cleanDsnTypePrefix(dsn['reporting-mta'] || '');
  const remoteMta = cleanDsnTypePrefix(dsn['remote-mta'] || '');

  // Fall back to body parsing when the sender strips the message/delivery-status part.
  if (!enhancedStatus) {
    const statusMatch = (diagnostic || combinedText).match(/\b([45]\.\d{1,3}\.\d{1,3})\b/);
    if (statusMatch) enhancedStatus = statusMatch[1];
  }

  let smtpCode = '';
  const smtpCodeMatch = (diagnostic || combinedText).match(/\b([45][0-5]\d)\b/);
  if (smtpCodeMatch) smtpCode = smtpCodeMatch[1];

  if (!diagnostic) {
    const diagLineMatch = combinedText.match(
      /(?:^|\n)\s*((?:550|551|552|553|554|421|450|451|452)[^\n]{5,280})/i
    );
    if (diagLineMatch) {
      diagnostic = diagLineMatch[1].trim();
    } else {
      const reasonMatch = combinedText.match(/(?:reason|error|diagnostic|response)\s*:\s*([^\n]{5,240})/i);
      if (reasonMatch) diagnostic = reasonMatch[1].trim();
    }
  }

  if (!finalRecipient) {
    const recMatch = combinedText.match(
      /(?:to|recipient|address|deliver(?:ed|ing)?\s+to|message\s+wasn't\s+delivered\s+to)\s*:?\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i
    );
    if (recMatch) finalRecipient = recMatch[1].toLowerCase();
  }

  const diagLower = `${diagnostic} ${subjectNorm} ${combinedText.slice(0, 1000)}`.toLowerCase();
  let category = 'hard_bounce';
  let severity = 'hard';
  let label = 'Hard Bounce (Gagal Permanen)';
  let explanation = 'Server penerima menolak email secara permanen.';

  const isSoftCode =
    enhancedStatus.startsWith('4.') ||
    smtpCode.startsWith('4') ||
    action === 'delayed';

  if (
    enhancedStatus === '5.1.1' ||
    enhancedStatus === '5.1.2' ||
    enhancedStatus === '5.1.10' ||
    /does not exist|user unknown|no such user|address not found|unknown user|mailbox unavailable|invalid recipient|recipient address rejected|account that you tried to reach does not exist/.test(
      diagLower
    )
  ) {
    category = 'user_unknown';
    severity = 'hard';
    label = 'Hard Bounce: Alamat Tidak Ditemukan';
    explanation = 'Alamat email tujuan tidak ada, salah ketik, atau akun sudah dihapus di server penerima.';
  } else if (
    enhancedStatus === '5.2.2' ||
    enhancedStatus === '4.2.2' ||
    smtpCode === '552' ||
    smtpCode === '452' ||
    /mailbox full|over quota|out of storage|quota exceeded|insufficient storage/.test(diagLower)
  ) {
    category = 'mailbox_full';
    severity = isSoftCode ? 'soft' : 'hard';
    label = isSoftCode ? 'Soft Bounce: Kotak Masuk Penuh' : 'Hard Bounce: Kuota Penuh';
    explanation = 'Penyimpanan kotak masuk penerima penuh sehingga pesan tidak dapat diterima.';
  } else if (
    enhancedStatus.startsWith('5.7.') ||
    enhancedStatus.startsWith('4.7.') ||
    smtpCode === '554' ||
    /blocked|spam|spf|dkim|dmarc|policy|reputation|blacklist|rbl|unauthenticated|authentication/.test(diagLower)
  ) {
    category = 'policy_block';
    severity = isSoftCode ? 'soft' : 'hard';
    label = isSoftCode ? 'Soft Bounce: Dibatasi Kebijakan / Rate Limit' : 'Hard Bounce: Diblokir Kebijakan / Spam';
    explanation = 'Server penerima menolak pesan karena kebijakan keamanan (SPF, DKIM, DMARC, reputasi IP, atau filter spam).';
  } else if (isSoftCode) {
    category = 'soft_bounce';
    severity = 'soft';
    label = 'Soft Bounce (Tertunda Sementara)';
    explanation = 'Kegagalan sementara di server tujuan; server pengirim mungkin akan mencoba ulang otomatis.';
  }

  return {
    isBounce: true,
    bounceInfo: {
      category,
      severity,
      label,
      explanation,
      action,
      smtpCode: smtpCode || null,
      enhancedStatus: enhancedStatus || null,
      finalRecipient: finalRecipient || null,
      reportingMta: reportingMta || null,
      remoteMta: remoteMta || null,
      diagnostic: diagnostic || null,
      originalSubject: orig.originalSubject || null,
      originalMessageId: orig.originalMessageId || null,
      rawDsn: rawDsn ? rawDsn.trim() : null,
    },
  };
}

// Skip bounce messages so SMTP status codes are never mistaken for OTP codes.
export function extractOtpCode(subject, textBody, htmlBody, isBounce) {
  if (isBounce) return null;

  const combined = `${subject || ''}\n${textBody || stripHtml(htmlBody || '')}`;
  const hasOtpContext =
    /\b(?:otp|kode|code|verifikasi|verification|verify|passcode|pin|konfirmasi|confirm|security code|login code|one-time|satu kali|autentikasi|authentication|aktivasi|activation|2fa|sign-in code)\b/i.test(
      combined
    );

  if (!hasOtpContext) return null;

  const explicitPatterns = [
    /(?:kode(?:\s+(?:verifikasi|otp|keamanan|login|masuk|konfirmasi))?|verification\s+code|security\s+code|login\s+code|otp(?:\s+code)?|passcode|one-time\s+(?:code|password)|pin)\s*(?:anda|kamu|adalah|is|:|-)?\s*[:#-]?\s*\*{0,2}\s*([0-9]{4,8}|[0-9]{3}-[0-9]{3})\b/i,
    /\b([0-9]{4,8}|[0-9]{3}-[0-9]{3})\s+(?:adalah|is)\s+(?:kode|your\s+(?:verification|otp|security|login)\s+code)/i,
  ];

  for (const regex of explicitPatterns) {
    const match = combined.match(regex);
    if (match && match[1]) {
      const candidate = match[1].replace(/-/g, '');
      if (!isLikelyYearOrNoise(candidate)) {
        return match[1];
      }
    }
  }

  const standaloneMatch = combined.match(/(?:^|\n|\s)([0-9]{6})(?:\s|$|\.)/);
  if (standaloneMatch && standaloneMatch[1] && !isLikelyYearOrNoise(standaloneMatch[1])) {
    return standaloneMatch[1];
  }

  return null;
}

function isLikelyYearOrNoise(code) {
  const digits = String(code).replace(/\D/g, '');
  if (digits.length === 4) {
    const num = Number(digits);
    if (num >= 1990 && num <= 2039) return true;
  }
  if (/^0+$/.test(digits)) return true;
  return false;
}

export async function parseIncomingEmail({ raw, envelopeFrom = '', envelopeTo = '' }) {
  let rawBytes;
  if (raw instanceof Uint8Array) {
    rawBytes = raw;
  } else if (raw instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(raw);
  } else if (typeof raw === 'string') {
    rawBytes = new TextEncoder().encode(raw);
  } else {
    throw new Error('Unsupported raw email input type');
  }

  const sizeBytes = rawBytes.byteLength;
  const rawSourceFull = textDecoder.decode(rawBytes);
  const rawSource =
    rawSourceFull.length > MAX_RAW_SOURCE_CHARS
      ? `${rawSourceFull.slice(0, MAX_RAW_SOURCE_CHARS)}\n\n[... Sumber MIME dipotong melebihi 512 KB ...]`
      : rawSourceFull;

  const parsed = await PostalMime.parse(rawBytes);

  const normalizedHeaders = (parsed.headers || []).map((h) => ({
    key: String(h.key || ''),
    value: String(h.value || ''),
  }));

  const fromObj = parsed.from || {};
  const fromAddress = String(fromObj.address || '').trim();
  const fromName = String(fromObj.name || '').trim();
  const sender = String(envelopeFrom || '').trim() || fromAddress || '<>';

  const headerToList = Array.isArray(parsed.to)
    ? parsed.to.map((r) => (r.name ? `${r.name} <${r.address}>` : r.address)).filter(Boolean)
    : [];
  const headerTo = headerToList.join(', ');

  // Envelope recipient takes precedence for catch-all routing, BCC, and bounces.
  const recipientRaw =
    String(envelopeTo || '').trim() ||
    (Array.isArray(parsed.to) && parsed.to[0]?.address ? parsed.to[0].address : '');
  const recipient = recipientRaw.toLowerCase().replace(/^<|>$/g, '').trim();

  const atIndex = recipient.lastIndexOf('@');
  const localPart = atIndex > 0 ? recipient.slice(0, atIndex) : recipient;
  const domain = atIndex > 0 ? recipient.slice(atIndex + 1).replace(/\.+$/, '') : '';

  const subject = String(parsed.subject || '').trim() || '(Tanpa Subjek)';
  const textBody = String(parsed.text || '');
  const htmlBody = String(parsed.html || '');

  const { isBounce, bounceInfo } = analyzeBounce({
    envelopeFrom: sender,
    fromAddress,
    fromName,
    subject,
    headers: normalizedHeaders,
    textBody,
    htmlBody,
    attachments: parsed.attachments || [],
  });

  const otpCode = extractOtpCode(subject, textBody, htmlBody, isBounce);
  const authResults = parseAuthResults(normalizedHeaders);

  const messageType = isBounce ? 'bounce' : otpCode ? 'otp' : 'inbox';
  const snippet = isBounce && bounceInfo?.diagnostic
    ? `${bounceInfo.smtpCode ? `[${bounceInfo.smtpCode}] ` : ''}${bounceInfo.diagnostic}`.slice(0, 180)
    : makeSnippet(textBody, htmlBody);

  // Exclude machine-readable delivery-status parts already captured in bounceInfo.rawDsn.
  const MAX_CID_INLINE_BYTES = 450_000;
  const attachments = [];
  const cidImageMap = new Map();
  for (const att of parsed.attachments || []) {
    const mimeType = String(att.mimeType || 'application/octet-stream').toLowerCase();
    if (mimeType === 'message/delivery-status' || mimeType === 'message/global-delivery-status') {
      continue;
    }
    let attBytes;
    if (att.content instanceof Uint8Array) {
      attBytes = att.content;
    } else if (att.content instanceof ArrayBuffer) {
      attBytes = new Uint8Array(att.content);
    } else if (typeof att.content === 'string') {
      attBytes = new TextEncoder().encode(att.content);
    } else {
      attBytes = new Uint8Array(0);
    }

    const attSize = attBytes.byteLength;
    const base64Data = attSize <= MAX_INLINE_ATTACHMENT_BYTES ? bytesToBase64(attBytes) : null;
    const rawCid = String(att.contentId || '').trim().replace(/^<|>$/g, '').trim();
    if (rawCid && base64Data && attSize <= MAX_CID_INLINE_BYTES && /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon)$/i.test(mimeType)) {
      cidImageMap.set(rawCid.toLowerCase(), `data:${mimeType};base64,${base64Data}`);
    }

    const filename =
      att.filename ||
      (mimeType === 'message/rfc822' || mimeType === 'text/rfc822-headers'
        ? 'original-message.eml'
        : `attachment-${attachments.length + 1}`);

    attachments.push({
      id: crypto.randomUUID(),
      filename,
      mimeType,
      sizeBytes: attSize,
      contentBase64: base64Data,
    });
  }

  let resolvedHtmlBody = htmlBody;
  if (resolvedHtmlBody && cidImageMap.size > 0) {
    resolvedHtmlBody = resolvedHtmlBody.replace(/cid:([^"'\s)>]+)/gi, (match, cidRaw) => {
      const key = String(cidRaw || '').trim().toLowerCase();
      return cidImageMap.get(key) || match;
    });
  }

  return {
    id: crypto.randomUUID(),
    recipient: domain ? `${localPart}@${domain}` : recipient,
    localPart,
    domain,
    sender,
    fromName,
    fromAddress,
    headerTo,
    subject,
    snippet,
    textBody,
    htmlBody: resolvedHtmlBody,
    messageType,
    isBounce,
    bounceInfo,
    otpCode,
    authResults,
    headers: normalizedHeaders,
    rawSource,
    sizeBytes,
    attachments,
    receivedAt: Date.now(),
  };
}
