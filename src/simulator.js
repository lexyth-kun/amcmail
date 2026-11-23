function rfcDate() {
  return new Date().toUTCString();
}

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function buildSimulatedEmail(scenario, recipientAddress, custom = {}) {
  const dateStr = rfcDate();
  const msgId = `<sim-${crypto.randomUUID()}@amc.web.id>`;
  const boundary = `----=_AMC_Part_${crypto.randomUUID().slice(0, 12)}`;

  if (scenario === 'hard_bounce') {
    const failedTarget = custom.failedTarget || 'pelanggan.nonaktif99@gmail.com';
    const raw = [
      'Return-Path: <>',
      `Date: ${dateStr}`,
      'From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      `To: ${recipientAddress}`,
      'Subject: Delivery Status Notification (Failure)',
      `Message-ID: ${msgId}`,
      'Auto-Submitted: auto-replied',
      `X-Failed-Recipients: ${failedTarget}`,
      'Authentication-Results: mx.cloudflare.net; spf=pass smtp.mailfrom=googlemail.com; dkim=pass header.d=googlemail.com; dmarc=pass',
      'MIME-Version: 1.0',
      `Content-Type: multipart/report; report-type=delivery-status; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      'Address not found',
      '',
      `Your message was not delivered to ${failedTarget} because the address could not be found or cannot receive mail.`,
      '',
      'The response from the remote server was:',
      "550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces.",
      '',
      `--${boundary}`,
      'Content-Type: message/delivery-status',
      '',
      'Reporting-MTA: dns; mail-sor-f69.google.com',
      `Arrival-Date: ${dateStr}`,
      '',
      `Final-Recipient: rfc822; ${failedTarget}`,
      'Action: failed',
      'Status: 5.1.1',
      'Remote-MTA: dns; gmail-smtp-in.l.google.com',
      "Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address.",
      '',
      `--${boundary}`,
      'Content-Type: text/rfc822-headers',
      '',
      `From: AMC Billing <${recipientAddress}>`,
      `To: ${failedTarget}`,
      'Subject: Invoice Perpanjangan Akun Premium AMC #INV-2026-884',
      `Message-ID: <orig-${crypto.randomUUID().slice(0, 8)}@amc.web.id>`,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return { envelopeFrom: '', envelopeTo: recipientAddress, raw };
  }

  if (scenario === 'soft_bounce') {
    const failedTarget = custom.failedTarget || 'inbox.penuh@yahoo.com';
    const raw = [
      'Return-Path: <>',
      `Date: ${dateStr}`,
      'From: Mail Delivery System <MAILER-DAEMON@mta7.am0.yahoodns.net>',
      `To: ${recipientAddress}`,
      'Subject: Delivery incomplete: Mailbox Full (Soft Bounce)',
      `Message-ID: ${msgId}`,
      'Auto-Submitted: auto-replied',
      `X-Failed-Recipients: ${failedTarget}`,
      'Authentication-Results: mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass',
      'MIME-Version: 1.0',
      `Content-Type: multipart/report; report-type=delivery-status; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      `There was a temporary problem delivering your message to ${failedTarget}.`,
      'Server will retry for 44 more hours.',
      '',
      'Response: 452 4.2.2 The email account that you tried to reach is over quota / mailbox full.',
      '',
      `--${boundary}`,
      'Content-Type: message/delivery-status',
      '',
      'Reporting-MTA: dns; mta7.am0.yahoodns.net',
      `Arrival-Date: ${dateStr}`,
      '',
      `Final-Recipient: rfc822; ${failedTarget}`,
      'Action: delayed',
      'Status: 4.2.2',
      'Remote-MTA: dns; mta6.am0.yahoodns.net',
      'Diagnostic-Code: smtp; 452 4.2.2 Over quota: recipient mailbox storage limit exceeded',
      '',
      `--${boundary}`,
      'Content-Type: text/rfc822-headers',
      '',
      `From: ${recipientAddress}`,
      `To: ${failedTarget}`,
      'Subject: Detail Akses Order #AMC-4910',
      `Message-ID: <orig-${crypto.randomUUID().slice(0, 8)}@amc.web.id>`,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return { envelopeFrom: '', envelopeTo: recipientAddress, raw };
  }

  if (scenario === 'policy_bounce') {
    const failedTarget = custom.failedTarget || 'security@corp-mail.co.id';
    const raw = [
      'Return-Path: <>',
      `Date: ${dateStr}`,
      'From: Postmaster <postmaster@corp-mail.co.id>',
      `To: ${recipientAddress}`,
      'Subject: Undelivered Mail Returned to Sender (DMARC Policy Reject)',
      `Message-ID: ${msgId}`,
      'Auto-Submitted: auto-replied',
      `X-Failed-Recipients: ${failedTarget}`,
      'Authentication-Results: mx.cloudflare.net; spf=pass; dkim=none; dmarc=fail',
      'MIME-Version: 1.0',
      `Content-Type: multipart/report; report-type=delivery-status; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      `Your message to ${failedTarget} was blocked by recipient security policy.`,
      '550 5.7.1 Unauthenticated email is not accepted due to domain DMARC policy.',
      '',
      `--${boundary}`,
      'Content-Type: message/delivery-status',
      '',
      'Reporting-MTA: dns; mx1.corp-mail.co.id',
      `Arrival-Date: ${dateStr}`,
      '',
      `Final-Recipient: rfc822; ${failedTarget}`,
      'Action: failed',
      'Status: 5.7.1',
      'Remote-MTA: dns; mx1.corp-mail.co.id',
      'Diagnostic-Code: smtp; 550 5.7.1 Unauthenticated email from sender domain rejected due to DMARC policy (p=reject)',
      '',
      `--${boundary}`,
      'Content-Type: text/rfc822-headers',
      '',
      `From: ${recipientAddress}`,
      `To: ${failedTarget}`,
      'Subject: Penawaran Kerja Sama Digital AMC',
      `Message-ID: <orig-${crypto.randomUUID().slice(0, 8)}@amc.web.id>`,
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return { envelopeFrom: '', envelopeTo: recipientAddress, raw };
  }

  if (scenario === 'otp') {
    const otp = randomOtp();
    const raw = [
      `Date: ${dateStr}`,
      'From: Security Service <no-reply@accounts-verify.example.com>',
      `To: ${recipientAddress}`,
      `Subject: Kode Verifikasi Login Anda: ${otp}`,
      `Message-ID: ${msgId}`,
      'Authentication-Results: mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass',
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      'Halo,',
      '',
      'Gunakan kode verifikasi berikut untuk menyelesaikan login akun Anda:',
      '',
      `Kode OTP Anda: ${otp}`,
      '',
      'Kode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.',
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      '<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f6f8;padding:24px;color:#0f172a;">',
      '<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:28px;">',
      '<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#0369a1;letter-spacing:.04em;text-transform:uppercase;">Verifikasi Keamanan</p>',
      '<h2 style="margin:0 0 12px;font-size:20px;">Konfirmasi Login Akun Anda</h2>',
      `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">Masukkan kode verifikasi 6 digit berikut untuk melanjutkan login alamat <strong>${recipientAddress}</strong>:</p>`,
      '<div style="background:#f0f9ff;border:1px solid #7dd3fc;border-radius:8px;padding:18px;text-align:center;margin-bottom:20px;">',
      `<span style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:30px;font-weight:700;letter-spacing:.2em;color:#075985;">${otp}</span>`,
      '</div>',
      '<p style="margin:0;font-size:12px;color:#475569;">Kode berlaku selama 10 menit. Abaikan email ini jika Anda tidak meminta login.</p>',
      '</div></body></html>',
      '',
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return { envelopeFrom: 'no-reply@accounts-verify.example.com', envelopeTo: recipientAddress, raw };
  }

  if (scenario === 'custom' && (custom.subject || custom.body)) {
    const fromAddr = custom.from || 'pengirim@contoh.id';
    const subj = custom.subject || 'Pesan Uji Coba AMC Mail';
    const body = custom.body || 'Halo, ini pesan uji coba yang dikirim ke alamat sementara Anda.';
    const raw = [
      `Date: ${dateStr}`,
      `From: ${fromAddr}`,
      `To: ${recipientAddress}`,
      `Subject: ${subj}`,
      `Message-ID: ${msgId}`,
      'Authentication-Results: mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
      '',
    ].join('\r\n');
    return { envelopeFrom: fromAddr, envelopeTo: recipientAddress, raw };
  }

  const receiptText = utf8ToBase64(
    `AL MUTHI CREATIVE: BUKTI TEST EMAIL\nKepada: ${recipientAddress}\nWaktu: ${dateStr}\nStatus: Diterima oleh AMC Mail Worker\n`
  );
  const raw = [
    `Date: ${dateStr}`,
    'From: Al Muthi Creative <hello@amc.web.id>',
    `To: ${recipientAddress}`,
    'Subject: Pesan Masuk Uji Coba AMC Mail',
    `Message-ID: ${msgId}`,
    'Authentication-Results: mx.cloudflare.net; spf=pass; dkim=pass; dmarc=pass',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    '<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f6f8;padding:24px;color:#0f172a;">',
    '<div style="max-width:540px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:28px;">',
    '<h2 style="margin:0 0 10px;color:#0369a1;">Kotak Masuk AMC Mail Aktif</h2>',
    `<p style="font-size:14px;line-height:1.65;color:#334155;">Email ini berhasil diterima untuk alamat <strong>${recipientAddress}</strong>.</p>`,
    '<ul style="font-size:14px;line-height:1.7;color:#334155;padding-left:20px;">',
    '<li>Menerima pesan di seluruh domain aktif AMC.</li>',
    '<li>Menampilkan pesan HTML beserta gambar dan teks polos dengan aman.</li>',
    '<li>Mengekstrak kode OTP secara otomatis untuk disalin langsung.</li>',
    '<li>Menyediakan lampiran file dan unduhan sumber mentah <code>.eml</code>.</li>',
    '</ul>',
    '<p style="margin-top:20px;font-size:12px;color:#475569;">Dikirim dari sistem uji coba Al Muthi Creative.</p>',
    '</div></body></html>',
    '',
    `--${boundary}`,
    'Content-Type: text/plain; name="bukti-penerimaan-amc.txt"',
    'Content-Disposition: attachment; filename="bukti-penerimaan-amc.txt"',
    'Content-Transfer-Encoding: base64',
    '',
    receiptText,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return { envelopeFrom: 'hello@amc.web.id', envelopeTo: recipientAddress, raw };
}
