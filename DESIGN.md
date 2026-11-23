# DESIGN.md: AMC Mail (Al Muthi Creative)

## Direction
Clean, simple, ultra-lightweight pure-white email reader and multi-domain mailbox manager for Al Muthi Creative (`tempmail.amc.web.id`), uniting uncluttered single-column mail-reading ergonomics with the exact sky-blue visual identity of `order.amc.web.id`. Zero 3D/WebGL dependencies, zero heavy blur layers, and zero random address generation.

- **Brand Name**: **AMC Mail** (Al Muthi Creative).
- **Single Font (Matching `order.amc.web.id`)**: `Plus Jakarta Sans` (`400;500;600;700;800;900`) exclusively across every surface, dropdown, tab, table, email code block, and sanitized email iframe.
- **Mood**: Pure White (`#ffffff`) normal Light Mode canvas paired with the exact `order.amc.web.id` AMC Sky Blue palette (`#7dd3fc` to `#38bdf8` brand gradient, `#bae6fd` borders, `#e0f2fe` / `#f0f9ff` subtle cards, `#0284c7` / `#075985` accents) and optional Dark Mode (`#0b1220` / `#0f172a`).
- **Dual-Mode Architecture**:
  - **Public Read-Only Mailbox (Centered `860px` Single-Column)**: Slim sticky top bar (`AMC Mail`, `AMC Order`, theme toggle, `Admin`), compact sky email lookup card (`username @ [Custom Sky Domain Dropdown] [Buka Inbox] [Salin]`), and one spacious full-width Inbox/Reader card with 3 clean filter tabs (`Semua`, `Masuk`, `OTP`), full-width message rows with avatar tiles, 1-click OTP copy, and automatic HTML email image rendering (`no-referrer`, inline `cid:` data URIs, and normalized `//` URLs).
  - **Full-Page Workspace Admin (After PIN Login)**: Transforms into the full `order.amc.web.id` `304px` left desktop sidebar (and 4-slot mobile bottom nav), `.desktop-welcome-card`, 3-card `.desktop-stat-grid` (`Email`, `Pesan`, `Domain`), `.step-badge` numbered circles, custom sky-blue dropdowns (`.amc-dropdown`), sky bulk accordion dropdown, split-pane Catch-All inbox, Domain manager, and Settings/Test Sender.

## Verified Palette (WCAG AA >= 4.5:1)
- **Light Mode (default)**:
  - Page Canvas & Cards: `#ffffff`
  - Subtle Sky Surfaces: `#f0f9ff`, `#e0f2fe`, welcome gradient `#e0f2fe -> #f0f9ff`, unread row tint `#f8fcff`
  - Borders: `rgba(186, 230, 253, 0.88)` (structural), `#7dd3fc` (controls), `#38bdf8` (focus)
  - Primary text: `#0f172a` (`17.85:1`), secondary `#334155` (`10.35:1`), muted `#475569` (`7.58:1`)
  - Primary brand button & active tabs: `linear-gradient(135deg, #7dd3fc, #38bdf8)` with `#082f49` ink (`6.48:1` on `#38bdf8`, `8.32:1` on `#7dd3fc`)
  - Sky accent links/badges on light surfaces: `#075985` on `#ffffff` (`7.56:1`), `#f0f9ff` (`7.09:1`), and `#e0f2fe` (`6.59:1`)
  - OTP Accent: `#065f46` on `#ecfdf5` (`7.29:1`)
- **Dark Mode**:
  - Canvas: `#0b1220`, cards `#0f172a`, secondary `#142238`, active dropdown `#163252`
  - Primary text: `#f8fafc` (`17.89:1`), secondary `#cbd5e1` (`12.02:1`), muted `#94a3b8` (`6.96:1`)
  - Sky accent `#7dd3fc` on `#142238` (`9.57:1`) and `#163252` (`7.81:1`)
  - OTP Accent: `#a7f3d0` on `#0e2b22` (`11.80:1`)

## Access Model
- **Public Visitors**: Read-only access to email addresses created and activated by Admin (open by entering `username@domain` or direct `?email=...` link). Cannot create addresses, randomize usernames, or delete messages.
- **Admin (PIN protected)**: Full Workspace Admin (`Buat & Kelola Email`, split-pane `Semua Pesan`, `Buka Per Alamat`, `Kelola Domain`, `Pengaturan & Uji Kirim`, and `Keluar Admin`).
