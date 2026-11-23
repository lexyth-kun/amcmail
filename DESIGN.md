# DESIGN.md: AMC Mail (Al Muthi Creative)

## Direction
Ultra-lightweight pure-white email reader, multi-domain mailbox manager, and SMTP bounce monitor for Al Muthi Creative (`tempmail.amc.web.id`), aligned 1-to-1 with the visual system of `order.amc.web.id`. Zero 3D/WebGL dependencies, zero heavy blur layers, and zero random address generation. Only Admin can create or manage email addresses; public visitors have a fast read-only mailbox viewer, while logged-in Admins enter a dedicated Full-Page Workspace Admin.

- **Single Font (Matching `order.amc.web.id`)**: `Plus Jakarta Sans` (`400;500;600;700;800;900`) exclusively across every surface, heading, button, badge, input, table, email code block, and sanitized email iframe.
- **Mood**: Pure White (`#ffffff`) normal Light Mode canvas paired with the exact `order.amc.web.id` AMC Sky Blue palette (`#7dd3fc` to `#38bdf8` brand gradient, `#bae6fd` borders, `#e0f2fe` / `#f0f9ff` subtle cards, `#0284c7` / `#075985` accents) and optional Dark Mode (`#0b1220` / `#0f172a`).
- **Signature `order.amc.web.id` Elements**:
  - `304px` fixed left desktop sidebar (`>= 1024px`) with `60x60px` rounded-`20px` white logo tile and `.logo-sweep-wrap` highlight sweep.
  - Rounded-`22px` `#f0f9ff` `.sidebar-user-card` with white `.sidebar-medal-icon` tile, `11px`/`900`/`0.18em` uppercase section labels, and `48px` rounded-`16px` sidebar nav links with `inset 4px 0 0 #38bdf8` active indicator.
  - `.desktop-welcome-card` (`linear-gradient(135deg, #e0f2fe, #f0f9ff)`), 4-card `.desktop-stat-grid` with `.desktop-stat-icon` sky tiles, `.step-badge` numbered circles (`1`, `2`), segmented sky pill tab docks (2x2 inbox filter tabs & `.deposit-tab-nav`-style reader tabs with icons and count chips), custom sky-blue dropdown menus (`.amc-dropdown` with floating portal popover, uppercase menu header, status-tinted pills, and `.payment-method-check`-style gradient checkmarks), sky bulk accordion dropdown, rounded-`16px` sky-blue gradient buttons, rounded-`24px` sky-header modal, circular mobile `.header-icon-btn`, and lightweight CSS custom blue glass desktop cursor.
- **Performance**: Pure HTML/CSS/ES module JS without external JS libraries or WebGL canvases.

## Verified Palette (WCAG AA >= 4.5:1)
- **Light Mode (default)**:
  - Page Canvas & Cards: `#ffffff`
  - Subtle Sky Surfaces: `#f0f9ff` (`--blue-tint`), `#e0f2fe` (`--blue-pale`), welcome gradient `#e0f2fe -> #f0f9ff`
  - Borders: `rgba(186, 230, 253, 0.88)` (structural), `#7dd3fc` (controls), `#38bdf8` (focus)
  - Primary text: `#0f172a` (`17.85:1`), secondary `#334155` (`10.35:1`), muted `#475569` (`7.58:1`)
  - Primary brand button: `linear-gradient(135deg, #7dd3fc, #38bdf8)` with `#082f49` ink (`6.48:1` on `#38bdf8`, `8.32:1` on `#7dd3fc`)
  - Sky accent links/badges on light surfaces: `#075985` on `#ffffff` (`7.56:1`), `#f0f9ff` (`7.09:1`), and `#e0f2fe` (`6.59:1`)
  - Bounce Hard: `#991b1b` on `#fef2f2` (`7.60:1`); Soft: `#78350f` on `#fffbeb` (`8.75:1`); OTP: `#065f46` on `#ecfdf5` (`7.29:1`)
- **Dark Mode**:
  - Canvas: `#0b1220`, cards `#0f172a`, secondary `#142238`
  - Primary text: `#f8fafc` (`17.06:1`), secondary `#cbd5e1` (`12.02:1`), muted `#94a3b8` (`6.96:1`)
  - Primary button: `linear-gradient(135deg, #7dd3fc, #38bdf8)` with `#082f49` ink (`6.48:1` to `8.32:1`)
  - Bounce Hard: `#fecaca` on `#2f1519` (`11.69:1`); OTP: `#a7f3d0` on `#0e2b22` (`11.80:1`)

## Access Model
- **Public Visitors**: Read-only access to email addresses created and activated by Admin (open by entering `username@domain` or direct `?email=...` link). Cannot create addresses, randomize usernames, or delete messages.
- **Admin (PIN protected)**: Transforms the entire page, desktop sidebar, and mobile bottom navigation into a dedicated Full-Page Workspace Admin (`Buat & Kelola Email`, split-pane `Semua Pesan & Bounce`, `Buka Per Alamat`, `Kelola Domain`, `Pengaturan & Uji Kirim`, and `Keluar Admin`).
