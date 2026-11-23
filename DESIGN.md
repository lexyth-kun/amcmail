# DESIGN.md: AMC Mail (Al Muthi Creative)

## Direction
Clean, ultra-lightweight pure-white email reader and SMTP bounce monitor for Al Muthi Creative (`tempmail.amc.web.id`). Zero 3D/WebGL dependencies, zero heavy blur layers, and zero random address generation. Only Admin can create or manage email addresses; public visitors have a fast read-only mailbox viewer.

- **Mood**: Clean Pure White (`#ffffff`) default canvas with AMC Blue (`#0277b5` / `#0369a1`) accents and optional Dark Mode (`#0f172a`).
- **Layout**: Fixed white left sidebar on desktop (`>= 1024px`), sticky white top bar and 4-slot bottom navigation bar on tablet/mobile (`< 1024px`), compact address lookup card, split-pane Inbox and Reader workspace, and active AMC domains grid.
- **Performance**: Pure HTML/CSS/ES module JS without external JS libraries or WebGL canvases.

## Verified Palette (WCAG AA >= 4.5:1)
- **Light Mode (default)**:
  - Canvas & Cards: `#ffffff`
  - Secondary surface: `#f8fafc`
  - Borders: `#e2e8f0` (structural), `#64748b` (inputs)
  - Primary text: `#0f172a` (`17.85:1`), secondary `#334155` (`10.35:1`), muted `#475569` (`7.58:1`)
  - Primary button: `#0277b5` / `#0369a1` with `#ffffff` ink (`4.87:1` to `5.93:1`)
  - Bounce Hard: `#991b1b` on `#fef2f2` (`7.60:1`); Soft: `#78350f` on `#fffbeb` (`8.75:1`); OTP: `#065f46` on `#ecfdf5` (`7.29:1`)
- **Dark Mode**:
  - Canvas: `#0b1220`, cards `#0f172a`, secondary `#1e293b`
  - Primary text: `#f8fafc` (`17.06:1`), secondary `#cbd5e1` (`12.02:1`), muted `#94a3b8` (`6.96:1`)
  - Primary button: `#38bdf8` with `#082f49` ink (`6.48:1`)
  - Bounce Hard: `#fecaca` on `#2f1519` (`11.69:1`); OTP: `#a7f3d0` on `#0e2b22` (`11.80:1`)

## Access Model
- **Public Visitors**: Read-only access to email addresses created and activated by Admin (open by entering `username@domain` or direct `?email=...` link). Cannot create addresses, randomize usernames, or delete messages.
- **Admin (PIN protected)**: Creates/manages email addresses (`Kelola Email`), copies shareable inbox links, views catch-all monitor (`Monitor Semua Inbox & Bounce`), manages AMC domains (`Kelola Domain`), and configures retention/tests (`Pengaturan & Uji Coba`).
