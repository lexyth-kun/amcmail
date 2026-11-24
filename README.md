# AMC Mail (Al Muthi Creative)

Layanan kotak masuk email multi-domain, generator autentikasi 2 faktor (2FA TOTP), dan Microsoft / Outlook Inbox Reader milik Al Muthi Creative berbasis Cloudflare Workers, Cloudflare Email Routing, dan Cloudflare D1.

## Fitur utama

- **Kotak Masuk Terpadu (`/`)**: Seluruh email masuk dan kode verifikasi OTP ditampilkan utuh dalam 1 kotak masuk tanpa tab terpisah dan tanpa hitungan mundur. Pada layar desktop, panel baca otomatis membuka pesan terbaru secara penuh tanpa ruang kosong.
- **Generator Kode 2FA TOTP (`/2fa`)**: Menghasilkan kode 2FA 6 digit standar RFC 6238 langsung di browser dari setup key Base32 atau tautan `otpauth://`, mendukung penyimpanan kunci lokal di perangkat, serta pembuatan tautan privat berbatas waktu (`/2fa?share=...`) yang hanya menampilkan kode 6 digit tanpa memperlihatkan setup key.
- **Microsoft / Outlook Inbox Reader (`/mail-reader`)**: Membuka kotak masuk Outlook, Hotmail, dan Microsoft 365 menggunakan Refresh Token & Client ID (`email|sandi|refresh_token|client_id` atau `email:sandi:refresh_token:client_id`) tanpa login interaktif dan tanpa menyimpan kredensial di server, lengkap dengan penggabungan otomatis folder Inbox + Junk Email (Spam) dan salin OTP satu klik.
- **Pembuatan alamat email AMC khusus Admin**: Hanya Admin (login PIN lewat ikon gembok di kanan atas) yang dapat membuat, mengaktifkan, menonaktifkan, atau menghapus alamat email pada domain AMC. Pengunjung publik membaca pesan dalam mode baca-saja.
- **Workspace Admin terpadu**: Buat & Kelola Email (tunggal/massal dan salin link inbox), Semua Pesan (Catch-All terpadu), Kelola Domain, dan Pengaturan Retensi.

## Struktur folder siap deploy

```text
amcmail/
├── DESIGN.md
├── README.md
├── package.json
├── wrangler.toml
├── .dev.vars.example
├── .gitignore
├── migrations/
│   ├── 0001_init.sql
│   ├── 0002_mailboxes.sql
│   └── 0003_totp_shares.sql
├── src/
│   ├── worker.js
│   ├── email-parser.js
│   ├── db.js
│   ├── auth.js
│   ├── totp.js
│   ├── ms-mail.js
│   └── simulator.js
└── public/
    ├── index.html
    ├── manifest.json
    ├── assets/amc-logo.png
    ├── css/style.css
    └── js/app.js
```

## Catatan migrasi D1 otomatis

Tabel `mailboxes` dan `totp_shares` otomatis dibuat oleh Worker (`CREATE TABLE IF NOT EXISTS`) pada permintaan pertama, sehingga deploy ke database D1 produksi yang sudah berjalan tidak memerlukan langkah SQL manual.
