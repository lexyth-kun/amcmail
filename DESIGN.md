# Design Direction: AMC Mail (Aligned with order.amc.web.id)

Identity: Multi-domain temporary mail and SMTP bounce monitor for Al Muthi Creative (AMC), designed as the direct visual sibling of order.amc.web.id.
Audience: AMC customers, digital account operators, and AMC admins monitoring incoming messages, OTP codes, and SMTP bounce reports across owned domains.
Personality: Luminous ice-sky glass workspace with responsive 3D routing depth powered by Three.js.
Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

## Palette (Inherited from order.amc.web.id, Verified WCAG AA >= 4.5:1)

- Light canvas: linear sky-ice gradient (`#eef9ff` -> `#f8fbff` -> `#e8f7ff`), frosted white glass surfaces (`rgba(255, 255, 255, 0.84)`), ice-blue borders (`rgba(186, 230, 253, 0.88)`), primary ink `#0f172a`, secondary ink `#334155`, muted ink `#475569`.
- Dark canvas: deep ocean gradient (`#06101f` -> `#0b182c` -> `#071324`), deep translucent ocean glass (`rgba(12, 26, 46, 0.84)`), cyan-slate borders (`rgba(56, 189, 248, 0.24)`), primary ink `#f0f9ff`, secondary ink `#cbd5e1`, muted ink `#94a3b8`.
- Brand accent: AMC Sky-Ocean gradient (`#0277b5` -> `#0369a1` with `#ffffff` ink in light mode; `#7dd3fc` -> `#38bdf8` with `#082f49` ink in dark mode).
- Semantic mail telemetry: crimson (`#991b1b` / `#fecaca`) for hard bounce, amber (`#78350f` / `#fde68a`) for soft bounce, emerald (`#065f46` / `#a7f3d0`) for OTP and auth pass.

## Typography

- Headings and wordmark: `Outfit` and `Plus Jakarta Sans` (weight 700-800), matching order.amc.web.id and AMC web properties.
- Interface copy: `Plus Jakarta Sans`.
- Email addresses, SMTP status codes, OTP values, and RFC headers: `IBM Plex Mono` with tabular numerals.

## Signature AMC Motifs & Three.js Direction

- Fixed left desktop ice-glass app sidebar (`>= 1024px`) paired with mobile frosted header and 5-slot floating bottom navigation bar with center sky-blue orb (`< 1024px`), mirroring order.amc.web.id.
- Custom blue-glass desktop pointer cursor and AMC logo light sweep matching order.amc.web.id.
- Interactive Three.js 3D AMC Mail Core (bevelled crystal envelope, orbiting domain satellites, dual routing rings, and live event ripples on generate/inbox/otp/bounce) plus subtle ambient crystal-node depth canvas, with explicit pause control and `prefers-reduced-motion` support.
