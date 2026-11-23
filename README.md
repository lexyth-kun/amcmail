# AMC Mail (Al Muthi Creative)

Layanan temporary mail multi-domain dan pemantau bounce SMTP berbasis Cloudflare Workers, Cloudflare Email Routing, dan Cloudflare D1.

## Domain bawaan

Migrasi awal (`migrations/0001_init.sql`) sudah menyiapkan enam domain milik Al Muthi Creative:

- `amc.web.id` (domain default)
- `lexyth.my.id`
- `rsykwnda.my.id`
- `almuthicreative.my.id`
- `jelupang.web.id`
- `cilpa.biz.id`

Domain tambahan yang belum bisa diakses saat ini dapat dicatat lewat Panel Admin dengan status `Pending`, lalu diaktifkan ketika Cloudflare Email Routing sudah terpasang.

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
│   └── 0001_init.sql
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

## Cara deploy ke Cloudflare

### 1. Siapkan database D1

Masuk ke folder `amcmail`, pasang dependensi, lalu buat database D1:

```bash
cd amcmail
npm install
npx wrangler login
npx wrangler d1 create amcmail-db
```

Salin `database_id` dari hasil perintah di atas ke file `wrangler.toml`.

### 2. Terapkan migrasi skema dan secret Admin

```bash
npm run db:migrate:remote
npx wrangler secret put ADMIN_PIN
npx wrangler secret put AUTH_SECRET
```

### 3. Deploy Worker dan aset statis

```bash
npm run deploy
```

Atau hubungkan folder `amcmail` ke repositori Git lalu pilih **Workers & Pages > Create Worker > Import a repository** di Cloudflare Dashboard (setelah `database_id` diisi di `wrangler.toml`, dan secret `ADMIN_PIN` serta `AUTH_SECRET` ditambahkan di Variables and Secrets).

### 4. Pasang custom domain website

Di Cloudflare Dashboard, buka Worker `amcmail`, masuk ke **Settings > Domains & Routes > Add > Custom Domain**, lalu masukkan subdomain tujuan (misalnya `mail.amc.web.id`).

### 5. Hubungkan Email Routing Catch-All untuk setiap domain

Ulangi langkah ini pada `amc.web.id`, `lexyth.my.id`, `rsykwnda.my.id`, `almuthicreative.my.id`, `jelupang.web.id`, `cilpa.biz.id`, dan domain baru di masa depan:

1. Buka domain tersebut di Cloudflare Dashboard lalu masuk ke **Email > Email Routing**.
2. Aktifkan Email Routing agar record MX dan TXT SPF terpasang otomatis.
3. Buka tab **Routing rules**, edit **Catch-all address**, aktifkan statusnya, pilih aksi **Send to a Worker**, lalu pilih Worker `amcmail`.
4. Simpan pengaturan. Seluruh email masuk, kode OTP, dan laporan bounce SMTP (`MAIL FROM: <>` / `MAILER-DAEMON`) akan langsung tercatat di D1.
