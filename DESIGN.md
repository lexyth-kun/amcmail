# Design Direction: AMC Mail

Identity: Multi-domain temporary mail and SMTP bounce monitor for Al Muthi Creative (AMC).
Audience: AMC users creating disposable addresses on AMC domains and AMC admins diagnosing incoming bounces across owned domains.
Personality: Direct postal-ledger utility. Technical clarity without marketing ornament.
Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Palette

- Core neutral light: `#f5f6f8` canvas, `#ffffff` primary surface, `#f1f4f8` secondary surface, `#0f172a` primary ink, `#334155` secondary ink, `#475569` muted ink.
- Core neutral dark: `#0b111c` canvas, `#111827` primary surface, `#182234` secondary surface, `#f1f5f9` primary ink, `#cbd5e1` secondary ink, `#94a3b8` muted ink.
- Brand accent: AMC Ocean Blue (`#0369a1` light / `#38bdf8` dark with `#082f49` dark ink on filled controls), taken from the existing Al Muthi Creative logo and site palette.
- Semantic telemetry colors (used only for real mail status): crimson (`#b91c1c` / `#fecaca`) for hard bounce, amber (`#92400e` / `#fde68a`) for soft bounce, emerald (`#065f46` / `#a7f3d0`) for OTP and auth pass.

## Typography

- Headings and brand wordmark: `Outfit`, matching existing Al Muthi Creative web properties.
- Interface text: `Plus Jakarta Sans`, matching AMC's primary typeface from existing site assets.
- Email addresses, SMTP codes, OTP values, and RFC headers: `IBM Plex Mono`, selected for tabular alignment and clear distinction between `0`/`O` and `1`/`l`.

## Identity Motif & Layout

- 3px AMC Ocean Blue top bar anchored across the header to establish brand identity without page-wide gradients or background glows.
- Four distinct vertical zones with deliberate rhythm shifts: compact brand header, wide composite address command bar, asymmetric two-column inbox and diagnostic reader, and compact inline domain directory with single-line footer.
- Motion restricted to discrete hover, active, focus, and view transitions; all motion stops under `prefers-reduced-motion: reduce`.
