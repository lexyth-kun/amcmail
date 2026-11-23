# AMC Mail (Al Muthi Creative)

Layanan kotak masuk email multi-domain milik Al Muthi Creative berbasis Cloudflare Workers, Cloudflare Email Routing, dan Cloudflare D1.

## Fitur utama

- **Pembuatan alamat email khusus Admin**: Hanya Admin (login PIN) yang dapat membuat, mengaktifkan, menonaktifkan, atau menghapus alamat email baru pada domain AMC.
- **Mode baca saja untuk pengunjung publik**: Pengunjung lain hanya dapat memasukkan alamat email yang sudah dibuat Admin (atau membuka tautan langsung `?email=...`) untuk membaca pesan masuk, menyalin kode OTP, dan mengunduh lampiran tanpa bisa membuat alamat baru atau menghapus pesan.
- **Ringan dan cepat**: Tampilan latar putih bersih tanpa 3D/WebGL, tanpa generator username acak, dengan opsi Mode Gelap.
- **Workspace Admin terpadu**: Buat & Kelola Email (tunggal/massal dan salin link inbox), Semua Pesan (Catch-All), Kelola Domain, dan Pengaturan Retensi.

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
│   └── 0002_mailboxes.sql
├── src/
│   ├── worker.js
│   ├── email-parser.js
│   ├── db.js
│   ├── auth.js
│   └── simulator.js
└── public/
    ├── index.html
    ├── manifest.json
    ├── assets/amc-logo.png
    ├── css/style.css
    └── js/app.js
```

## Catatan migrasi D1 otomatis

Tabel `mailboxes` otomatis dibuat oleh Worker (`CREATE TABLE IF NOT EXISTS mailboxes`) pada permintaan pertama, sehingga deploy ke database D1 produksi yang sudah berjalan tidak memerlukan langkah SQL manual.
