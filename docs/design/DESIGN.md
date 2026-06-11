---
version: alpha
name: Role Radar
description: >-
  A private, single-user job-hunt cockpit. A calm, dense-but-legible instrument
  — engineering/terminal feel, warm paper neutrals, one green signal. Built so a
  senior endpoint engineer can SEE FIT and catch the rare right role fast.
colors:
  # Brand signal — "go / match". The driver of action and identity.
  primary: "#1E8A4F"          # Radar green — fills, avatars, the Send-scouts action
  primary-strong: "#0F6B3B"   # deep green — white-text buttons + text on green tint (AA)
  on-primary: "#FFFFFF"
  primary-tint: "#E7F1E8"     # green wash behind matches / eligibility
  # Neutrals — warm greige "paper & ink", never pure black/white.
  ink: "#211E18"              # primary text & headlines
  muted: "#6E685D"            # secondary text
  faint: "#97907F"            # metadata, captions, placeholder
  paper: "#F4F2EC"            # app background
  surface: "#FBFAF6"          # cards & panels
  panel: "#EFECE4"            # sidebar / assistant rail / column wells
  border: "#E4DFD4"           # card & control borders
  hairline: "#EFEBE1"         # internal dividers, chip fills
  # Caution — "reach / hidden gem". Gold = treasure & stretch.
  caution: "#B07D26"
  caution-strong: "#8A5E14"
  caution-tint: "#F4ECDA"
  # Risk — "phantom / ineligible / domain mismatch". Warm rust, never alarm-red.
  risk: "#B0492B"
  risk-strong: "#8A4A2C"
  risk-tint: "#F6EAE3"
typography:
  display:
    fontFamily: IBM Plex Sans
    fontSize: 2.125rem
    fontWeight: 600
    letterSpacing: -0.01em
  h1:
    fontFamily: IBM Plex Sans
    fontSize: 1.5rem
    fontWeight: 600
    letterSpacing: -0.01em
  h2:
    fontFamily: IBM Plex Sans
    fontSize: 1.125rem
    fontWeight: 600
  body:
    fontFamily: IBM Plex Sans
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 0.8125rem
    fontWeight: 400
  label-caps:
    fontFamily: IBM Plex Mono
    fontSize: 0.625rem
    fontWeight: 600
    letterSpacing: 0.08em
  data:
    fontFamily: IBM Plex Mono
    fontSize: 0.9375rem
    fontWeight: 600
  mono-sm:
    fontFamily: IBM Plex Mono
    fontSize: 0.6875rem
    letterSpacing: 0.02em
rounded:
  sm: 6px
  md: 9px
  lg: 12px
  xl: 16px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 40px
components:
  app-shell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  sidebar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 12px
  verdict-match:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  verdict-reach:
    backgroundColor: "{colors.caution-tint}"
    textColor: "{colors.caution-strong}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  verdict-risk:
    backgroundColor: "{colors.risk-tint}"
    textColor: "{colors.risk-strong}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  badge-eligible:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
  phantom-flag:
    backgroundColor: "{colors.risk-tint}"
    textColor: "{colors.risk-strong}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.md}"
  gem-marker:
    backgroundColor: "{colors.caution-tint}"
    textColor: "{colors.caution-strong}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
  chip:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.muted}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
  data-readout:
    textColor: "{colors.ink}"
    typography: "{typography.data}"
---

## Overview

Role Radar is a **cockpit, not a job board** — a private instrument the owner sits
down to and "runs." The feeling is *engineering / terminal*: precise, technical,
quiet. Monospace carries every readout — labels, scores, metadata, flags — over a
warm paper background, so the screen reads like a well-built control panel rather
than a consumer SaaS dashboard.

Two principles govern everything:

1. **Transparency over decoration.** The signature element is the *fit-with-reasoning*
   read. A score is never shown without its "why." Spend boldness here; keep
   everything else disciplined.
2. **Calm, dense-but-legible.** This is low-volume, high-fit triage — careful, not a
   firehose. Information density is high, but type, spacing, and a single accent keep
   it scannable.

The product persona: **Radar**, a bot that dispatches **Scouts** across job sources
and brings back what fits — proposing, never acting alone (human-in-the-loop).

## Colors

A warm greige "paper & ink" foundation with a **single three-signal system**. Never
use pure black or pure white; whites stay warm and low-saturation.

- **Primary — Radar green (`#1E8A4F`):** identity and "go/match." Fills, the Radar
  avatar, the *Send scouts* action. `primary-strong` (`#0F6B3B`) is the AA-safe variant
  for white text on solid green and for text sitting on `primary-tint`.
- **Neutrals (`ink` → `faint`):** warm near-black down through metadata gray. `paper`
  is the app field, `surface` the cards, `panel` the rails — three steps of warmth, not
  brightness.
- **Caution — gold (`#B07D26`):** "reach" verdicts and **hidden gems**. Gold reads as
  *treasure and stretch*, distinct from a confirmed match.
- **Risk — warm rust (`#B0492B`):** **phantom/evergreen** reposts, US-only ineligibility,
  domain mismatch. Deliberately rust, not alarm-red — this is a considered flag, not an error.

The signal trio is the whole language: **green = confirmed fit, gold = undiscovered/
stretch, rust = risk to avoid.** Eligibility follows it (green check / rust US-only /
gold hybrid-or-uncertain).

## Typography

Two families, used with strict role separation:

- **IBM Plex Sans** — human text: role titles, verdict sentences, body copy.
- **IBM Plex Mono** — every instrument readout: uppercase tracked `label-caps`, the
  `data` voice for scores and counts, metadata lines, badges, nav.

The rule of thumb: **if it's a number, a label, or a status, it's mono.** This is what
gives the cockpit its precise, engineered character. Headlines stay tight
(`letterSpacing: -0.01em`); mono labels open up (`+0.08em`) and are uppercased in markup.

## Layout

A three-column shell on desktop: **sidebar nav** (`panel`) → **main column** (`paper`,
scrolls) → **assistant rail** (`panel`, Radar + the approval queue). A fixed top bar
holds the view title and the *Send scouts* action.

Spacing is an 8px-ish rhythm (`xs 4 → 2xl 40`). Cards use `lg` radius and `lg` padding;
controls use `md`. Prefer flex/grid with `gap` over margins so the dense layout survives
edits. Below ~820px the app is mobile-first: the rails collapse and `roleradar.bot` opens
straight into Radar (the bot), with a one-tap escape hatch back to the full cockpit.

## Elevation & Depth

Mostly flat — depth comes from the `paper`/`surface`/`panel` warmth steps and 1px
`border`/`hairline` lines, not shadow. Shadow is reserved for genuinely floating layers:
the assistant launcher, popovers/menus, the mobile bottom sheet, and the auth card.
Keep shadows soft, warm, and low (`0 8px 28px rgba(33,30,24,0.13)` range). The green
*Send scouts* button carries a subtle 1px bottom inset + soft green glow to read as the
primary action.

## Shapes

Rounded but not soft: `sm 6` for inline badges/chips, `md 9` for controls, `lg 12` for
cards, `xl 16` for modals/sheets, `pill` for the assistant launcher and quick-reply chips.
The brand mark is a 45°-rotated square (a radar diamond) with a green dot. **Radar the
bot** uses the Lucide `hat-glasses` glyph (the incognito/scout mark) at 24px / stroke-2;
the `◎` sweep glyph marks the Scout *mechanism* (nav + run). Never hand-draw complex
illustration — use placeholders or real assets.

## Components

Components compose tokens; variants (hover, active) are separate entries.

- **button-primary** — the green action (*Send scouts*, *Approve*, *Save*). White text on
  `primary-strong` for AA; brightens to `primary` on hover.
- **card** — every role, proposal, strength, and gem sits on a `surface` card with a
  3px left accent in its signal color (green/gold/rust).
- **verdict-match / -reach / -risk** — the tinted pills that headline a fit read. Always
  paired with the mono `data` score and the dimension meter.
- **badge-eligible / phantom-flag / gem-marker** — the eligibility check, the rust phantom
  flag (with seen-count timeline), and the gold gem tag.
- **chip** — mono micro-tags: reason chips (`+ Deep macOS/Jamf`), matched keywords, source labels.
- **data-readout** — the mono voice for any standalone number (fit score, seen-count, run summary).

Touch targets ≥ 44px on mobile. On 1920×1080 surfaces, text never below 24px; in the app
UI, never below the `mono-sm` floor.

## Do's and Don'ts

- **Do** show the reasoning with every score — dimension meter + plain-language verdict.
  Never a black-box number.
- **Do** keep the three-signal palette strict: green = fit, gold = gem/reach, rust = risk.
  Don't introduce new accent hues.
- **Do** present eligibility and fit as *informed hints with easy override*, never as
  certainty the data can't back.
- **Do** keep Radar human-in-the-loop: it proposes, the owner approves. Never design UI
  that auto-applies or contacts anyone.
- **Don't** use pure `#000`/`#fff`, gradients-for-decoration, emoji, or the generic
  rounded-card-with-left-border-accent SaaS trope.
- **Don't** let the layout feel like a kanban clone or admin template — it's a focused,
  considered instrument.
- **Don't** mix the type roles: numbers/labels/status are always mono; prose is always sans.
