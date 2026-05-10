# RZI Camp Design System

Design system for **RZI Camp** — an internal **ERP + GIS** web app for managing the **Roxgold Sango** mining camp residences in Burkina Faso. The product is in **French**, used by camp administrators to track residences, occupancy, incidents (maintenance), staff travel ("voyages"), events, requests ("demandes"), and notifications.

## What this product is

RZI Camp is a single **internal admin web application** — not customer-facing. It looks and feels like a serious operational tool: dense data tables, maps, KPIs, French copy with operational vocabulary (`Bâtiment`, `Résidence`, `Voyage`, `Incident`, `Demande`). The UI tone is factual, slightly formal, with emoji used freely as iconography in nav and KPI tiles to keep it scannable for non-technical users on shift.

It's a single product surfaced as a desktop-leaning React SPA. Two visual surfaces matter:

- **Web app** (React + Vite, route-based SPA): the real product
- **Auth flow** (Login screen): visually distinct, gradient-heavy, used as the entry point

There is no marketing site, no docs site, no mobile app in the codebase.

## Sources used to build this design system

| Source | Path | Notes |
|---|---|---|
| Frontend codebase | `GARO21225/rzi-camp` (GitHub) | React + Vite + Tailwind-free, inline styles + a small CSS token layer |
| Tokens | `frontend/src/index.css` | CSS variables: `--blue`, `--gold`, status colors, card/spacing/text |
| Layout chrome | `frontend/src/components/Layout.jsx` | Sidebar nav, top bar, brand mark, role-gated menu |
| Auth | `frontend/src/pages/Login.jsx` | Gradient hero, brand placement, form styling |
| Dashboard | `frontend/src/pages/Dashboard.jsx` | KPI tiles, hero banner, status bars, action grid |

No Figma, no separate brand book, no separate marketing site were provided. All visual decisions in this system are reverse-engineered from the codebase's inline styles and CSS tokens.

## Index of this folder

```
README.md                   ← you are here (brand + content + visual + iconography)
SKILL.md                    ← Claude Code skill manifest
colors_and_type.css         ← all CSS tokens (color, type, radii, shadow, spacing, motion)
assets/                     ← logo, brand marks (placeholder logo — see CAVEATS)
fonts/                      ← (none — uses system stack only; see Type)
preview/                    ← Design-System-tab cards
ui_kits/
  rzi-camp/                 ← the web app UI kit
    README.md
    index.html              ← interactive click-thru of the product
    *.jsx                   ← factored components (Sidebar, KPI, Card, etc.)
```

There is **one product** so there is **one UI kit** (`ui_kits/rzi-camp/`).

## CONTENT FUNDAMENTALS

How copy is written in this product:

- **Language:** French. All UI copy, labels, buttons, headings, error messages.
- **Voice:** Operational. Direct, neutral, slightly formal. Speaks **to** the operator, not from a brand persona. There is **no marketing voice**, no aspirational copy, no slogans.
- **Person:** Implicit second person via imperatives. Buttons read like commands: *« Gérer les résidences »*, *« Déclarer du personnel »*, *« Créer un événement »*, *« Voir les incidents »*. The system rarely says "I" or "you" — it says "do this".
- **Casing:** **Sentence case** for buttons, labels, page headings (French convention — only the first word and proper nouns capitalised). Not Title Case. ALL-CAPS is reserved for tiny tag-style labels under KPI numbers (e.g. `LIBRES`, `OCCUPÉS`, `BÂTIMENTS`) with letter-spacing.
- **Numbers:** Always shown in **monospace**, large, brightly coloured. Dashboards lead with the number, label is secondary. A "—" em-dash is the explicit empty/loading state for a numeric KPI.
- **Dates:** French long form, lowercased weekday: *« vendredi 15 mars 2024 »* (`toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})`).
- **Statuses:** A small fixed vocabulary, always used in the same tense and with a colour: `Libre` (green), `Occupé` (red), `Réservé` (blue), `Maintenance` (orange), `En voyage` (orange).
- **Alerts:** Punchy, single-line, prefixed with an emoji glyph: *« ⚠️ 3 départ(s) prévu(s) dans les 7 prochains jours »*, *« 🔔 Nouvelle demande en attente »*. Note the parenthetical `(s)` — the codebase doesn't pluralise dynamically, it uses `(s)` to cover both cases.
- **Tone vibe:** Calm, factual, no exclamation marks except in alerts. No emoji except as **functional icons** (next to nav items, KPI labels, alerts). Never decorative. No jokes, no "oops", no friendly chatbot voice — this is a tool people use during a shift.
- **Microcopy patterns:** Action-arrow at end of CTAs (`Gérer les résidences →`). Section headings use a leading emoji as a category marker (`📊 Statuts résidences`, `⚡ Actions rapides`).

Examples lifted from the codebase:

> ⚠️ {n} départ(s) prévu(s) dans les 7 prochains jours
> 🏠 Gérer les résidences →
> 📊 Taux occup.
> ✈️ En voyage
> Résidence Roxgold Sango

## VISUAL FOUNDATIONS

### Colour
- **One brand colour pair:** navy `#1e3a8a` paired with a slightly lighter blue `#2563eb`. They appear together as a **135° gradient** on the hero banner / sidebar header / login background.
- **One accent:** gold `#f0a500`. Used very deliberately — only on the headline KPI number ("Bâtiments") and on the logo's gold bar. Never as a primary action colour.
- **Status palette is fixed:** green `#16a34a` (libre/OK), red `#dc2626` (occupé/danger), orange `#ea580c` (maintenance/warning), purple `#7c3aed` (events), gold `#f0a500` (departs/pending).
- **Tinted backgrounds:** every status colour has a `0d`-suffixed (~5% alpha) tinted bg and a `25`-suffixed (~15% alpha) border for inline pills, action buttons, and alert banners. This is the *signature* card-inside-card treatment.
- **Neutrals:** very light cool grey canvas `#f5f7fb`, pure white surfaces, slate grey for secondary text. No warm greys.
- **Vibe:** trustworthy, mining-industrial, slightly bureaucratic. Not playful, not luxe, not techy-dark.

### Typography
- **System stack only.** No web fonts. `-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Monospace** is used heavily for **all numbers** (KPI values, totals, percentages) and for tag-style uppercase labels with wide letter-spacing. This gives the product its data-tool character.
- **Sizes are small** — body 12-13px, KPI labels 10-11px, KPI numbers 26-38px. The product packs a lot on screen; size differential is large between numbers (huge) and labels (tiny).
- **Weights:** 400, 600, 700. No 300/200 — never thin display.
- **Letter-spacing:** 1-2px on uppercase labels. Tight (-0.2px) only on rare large headings.

### Spacing & rhythm
- **4px base scale.** Common values: 6, 8, 10, 12, 14, 16, 18, 20, 24. The codebase uses literal pixel values via inline styles — not a Tailwind-style scale. Use the `--sp-*` tokens.
- **Padding inside cards:** typically `16-18px`. Header banner: `18-20px`. Alert banners: `10-16px`.
- **Gaps:** `6-14px` for KPI grids, `10-14px` for action button stacks.
- **Card grids:** auto-fill `minmax(130px, 1fr)` for KPI tiles. Two-column layouts for dashboards.

### Backgrounds & imagery
- **No photography in the app.** Login screen uses gradients only.
- **No hand-drawn illustrations**, **no patterns**, **no textures**, **no full-bleed imagery** anywhere in the product. The visual system is entirely flat colour + gradient + iconography (emoji).
- **Single hero gradient** (`135deg #1e3a8a → #2563eb`) used in 1-2 specific places (dashboard banner, login background).

### Motion
- **One animation:** `fadeIn` (opacity + 4px translateY) at `0.3s ease`. Applied on page mount and to inline status bars (which animate width to their value over 1s ease).
- **No bounces, no spring physics, no parallax, no scroll-tied animation.**
- **No page transitions** — routes swap content instantly.
- Hover transitions: card lift (`translateY(-1px)` + shadow change) over 0.3s.
- Progress bars (`width` change) are the only animated data visualisation.

### Hover & press states
- **Buttons:** background tint deepens slightly (e.g. `#1e3a8a` solid → very subtle darken; tinted button bg `colour0d` → `colour14`); cursor `pointer`; no shadow change.
- **Cards (clickable):** subtle lift via `translateY(-1px)` and slightly heavier shadow.
- **Press states:** not explicitly styled in the codebase — relies on browser defaults.
- **Focus states:** outline on form inputs (browser default + a colored border on the input).

### Borders & shadows
- **Hairline borders** (`1px solid #e5e7eb`) on every card, by default.
- **Top accent border** (`4px solid <statusColor>`) on KPI cards — this is the system's visual rhythm device. The colour of the top border is the only thing that varies between KPIs.
- **Shadow system is small (3 steps):**
  - `card`: `0 2px 8px rgba(15,23,42,.06)` — every card
  - `hero`: `0 4px 20px rgba(30,58,138,.25)` — gradient banner only
  - `hover`: `0 6px 16px rgba(15,23,42,.10)` — card hover only
- **No inner shadows.** No "neumorphic" effects.

### Radii
- **3 sizes:** `12px` (cards, callouts, alerts), `16px` (the hero gradient banner), `9-10px` (buttons, small pills).
- **6px** on progress bars only.
- **Pill** (`999px`) is rare — used on tag chips when present.
- The system is **uniformly rounded** — no sharp corners on any surface.

### Cards
A "card" in RZI Camp = white background, 1px hairline border, 12px radius, 2px-8px shadow, 16-18px padding. KPI cards add a 4px coloured top border. **Cards never have left-border accents** — top-border accents are the codebase's pattern.

### Layout
- **Fixed sidebar** on desktop (collapsible). **Fixed top bar.** Main content scrolls under both.
- Sidebar: navy `#1e3a8a` background, white text, emoji + label nav items, role-gated.
- **Layout breakpoints:** the app is desktop-first (no mobile redesign in code, but it does collapse the sidebar). Cards reflow via `auto-fill grid`.

### Transparency & blur
- **Used sparingly.** Only the `0d` (5%) tinted backgrounds on alert banners and action buttons over white. **No `backdrop-filter` blur** anywhere in the codebase.

### Image vibe
- N/A — there is no imagery beyond the logo. The login is gradient-only.

## ICONOGRAPHY

This is the unusual part of RZI Camp's visual language: **iconography is emoji**.

- **Primary icon system: native emoji**, used in plain Unicode. No icon font, no SVG sprite, no `lucide`, no `heroicons`, no Material Icons. Sidebar nav, KPI labels, action buttons, status alerts — **all** use emoji glyphs.
- Examples: `🏠` (résidences), `🗺️` (carte/GIS), `👤` (personnel), `📅` (événements), `🛠️` (maintenance), `📝` (demandes), `🔔` (notifications), `⚠️` (alerte), `✈️` (voyage), `📊` (statistiques), `⚡` (actions rapides), `🟢🔴` (status dots).
- **Never decorative.** Every emoji has a functional meaning tied to a data category.
- **Why:** This is an internal tool by a small team — emoji are zero-asset, render natively across OSes, and read instantly to non-English-speaking users. It's the *most accessible* iconography choice for this audience.
- **Logos / brand marks:** the Roxgold Sango wordmark (navy + orange) lives at `assets/roxgold-logo.png` (555×298 PNG, lifted from the inline base64 in `Layout.jsx` / `Dashboard.jsx`). It is designed to sit on a white plate — in the navy app header it's wrapped in a white rounded rectangle.
- **Status dots:** rendered as a coloured background-circle, not an emoji.
- **No SVG icons** in the codebase to copy.
- **Unicode arrows** (`→`) used as button trailing CTAs — frequent.

When designing **for** RZI Camp:
- Prefer emoji over hand-rolled SVG icons. It matches the system.
- If the use case demands true vector icons, **flag the substitution to the user** and use a low-stroke-weight set (Lucide `1.5px`) — but default behaviour is emoji.

## CAVEATS

- **No web fonts.** Codebase uses system stack only. If the brand has actual typeface preferences (Inter, Söhne, etc.), they're not present in the source. Confirm with the team.
- **No mobile spec.** Codebase has only desktop layouts; the sidebar collapses but no mobile-specific UI was found.
- **No accessibility documentation** in the source. Color contrast looks acceptable (navy on white, white on navy gradient) but should be audited.

## Index of preview cards

See `preview/` — each card is registered in the Design System tab with a viewport hint. Cards are split across: **Type**, **Colors**, **Spacing**, **Components**, **Brand**.
