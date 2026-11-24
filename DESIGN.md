# DESIGN.md: AMC Mail (Al Muthi Creative)

## Direction
Clean, full-viewport, ultra-lightweight pure-white email reader, RFC 6238 2FA Authenticator, Microsoft / Outlook OAuth Inbox Reader, and multi-domain mailbox manager for Al Muthi Creative (`tempmail.amc.web.id`), uniting frictionless desktop split-pane ergonomics with the exact sky-blue visual identity of `order.amc.web.id`. Zero 3D/WebGL dependencies, zero countdown timers, zero empty desktop whitespace, and zero random address generation.

- **Brand Name**: **AMC Mail** (Al Muthi Creative).
- **Single Font (Matching `order.amc.web.id`)**: `Plus Jakarta Sans` (`400;500;600;700;800;900`) exclusively across every surface, dropdown, tab, table, 2FA code display, email code block, and sanitized email iframe.
- **Mood**: Pure White (`#ffffff`) normal Light Mode canvas paired with the exact `order.amc.web.id` AMC Sky Blue palette (`#7dd3fc` to `#38bdf8` brand gradient, `#bae6fd` borders, `#e0f2fe` / `#f0f9ff` subtle cards, `#0284c7` / `#075985` accents) and optional Dark Mode (`#0b1220` / `#0f172a`).
- **Full-Viewport Desktop & Mobile Architecture**:
  - **Top Navigation Bar**: Brand emblem + segmented sky tool navigation (`Kotak Masuk` `/`, `2FA` `/2fa`, `Mail Reader` `/mail-reader`) + `AMC Order` link + theme toggle + circular `44x44` padlock-only Admin login button.
  - **Tool 1 (`/` Kotak Masuk Terpadu)**: Horizontal sky lookup bar (`username @ [Custom Sky Domain Dropdown] [Buka Inbox] [Salin]`) above a full-height master-detail split workspace (`410px` unified message list + `1fr` reader pane). All emails and OTP codes appear in one unified inbox without separate filter tabs or countdown timers, and the newest message auto-opens on desktop so there is zero empty space.
  - **Tool 2 (`/2fa` Generator Kode 2FA TOTP)**: Full-height 2-column workspace generating 6-digit RFC 6238 TOTP codes directly in the browser from Base32 setup keys or `otpauth://` URIs without visible countdown bars, plus local device key storage (`localStorage`) and expiring private code-only share links (`/2fa?share=...`) that never expose the secret key.
  - **Tool 3 (`/mail-reader` Microsoft / Outlook Inbox Reader)**: Stateless Microsoft Graph OAuth2 Refresh Token combo reader (`email|sandi|refresh_token|client_id` or `email:sandi:refresh_token:client_id`) merging `Inbox + Junk Email` by default, with live format detection, 1-click OTP copy, and auto-opened full HTML email reader on desktop.
  - **Full-Page Workspace Admin (After PIN Login)**: Full `order.amc.web.id` `304px` left desktop sidebar (and 4-slot mobile bottom nav), `.desktop-welcome-card`, 3-card `.desktop-stat-grid` (`Email`, `Pesan`, `Domain`), `.step-badge` numbered circles, custom sky-blue dropdowns (`.amc-dropdown`), unified split-pane Catch-All inbox, Domain manager, and Settings/Test Sender.

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
  - Canvas: `#0b1220`, cards `#0f172a`, secondary `#142238`, active dropdown `#163232`
  - Primary text: `#f8fafc` (`17.89:1`), secondary `#cbd5e1` (`12.02:1`), muted `#94a3b8` (`6.96:1`)
  - Sky accent `#7dd3fc` on `#142238` (`9.57:1`) and `#163252` (`7.81:1`)
  - OTP Accent: `#a7f3d0` on `#0e2b22` (`11.80:1`)

## Access Model
- **Public Visitors**: Read-only access to AMC email addresses created by Admin (`/` or `?email=...`), full access to browser-based 2FA Authenticator (`/2fa`), and stateless session-only Microsoft / Outlook Inbox Reader (`/mail-reader`).
- **Admin (PIN protected)**: Full Workspace Admin (`Buat & Kelola Email`, unified split-pane `Semua Pesan`, `Kelola Domain`, `Pengaturan & Uji Kirim`, plus shortcuts to `Buka Per Alamat`, `Generator 2FA`, and `Microsoft Reader`).
