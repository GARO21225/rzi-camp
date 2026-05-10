---
name: rzi-camp-design
description: Use this skill to generate well-branded interfaces and assets for RZI Camp (the Roxgold Sango mining-camp ERP/GIS web app), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

- Tokens: `colors_and_type.css` — import as `<link rel="stylesheet" href="colors_and_type.css">` to inherit `--rzi-blue`, `--rzi-gold`, status colors, type scale, radii, spacing.
- UI kit: `ui_kits/rzi-camp/` — copy `.jsx` components for Sidebar, KPICard, AlertBanner, ActionButton, GradientHeader.
- Logo: `assets/roxgold-logo.png` (Roxgold Sango wordmark — navy + orange on transparent/white background, 555×298). Sits inside a white plate when shown on the navy header.
- Iconography: **use emoji**. Do not draw SVG icons unless the user asks for them. Sidebar nav and KPI labels both lead with emoji.
- Copy: **French, sentence case, operational tone.** No marketing voice. Buttons read as imperatives (`Gérer les résidences →`).
- One brand gradient: `linear-gradient(135deg, #1e3a8a, #2563eb)` — use sparingly (hero banner / login background).
- One accent: gold `#f0a500` — only on headline numbers and logo. Never as a primary CTA.
- Cards: white bg, 1px `#e5e7eb` border, 12px radius, top-border 4px coloured accent for KPI variants.
