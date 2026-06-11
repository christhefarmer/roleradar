# Handoff: Role Radar — `roleradar.bot`

## Overview
Role Radar is a **private, single-user-per-account job-hunt cockpit** for a senior IT
specialist (Apple/macOS endpoint management — Jamf, Intune, MDM, identity/SSO — plus
React/TypeScript/AWS build credibility, Canada-eligible). Its job is **not** to flood the
user with listings; it is to help them **see fit fast and catch the rare right role**.

The product persona: **Radar**, a bot that dispatches **Scouts** across job sources,
reasons about fit against the user's résumé, flags phantom/evergreen reposts, surfaces
"hidden gems," and tracks roles through a pipeline — **human-in-the-loop** (Radar proposes,
the user approves; it never applies or contacts anyone).

This bundle contains two design prototypes:
- **`Role Radar.dc.html`** — the desktop cockpit (Scouts, Hidden Gems, Recommended + fit
  reasoning, Search & watchlist, Pipeline, Profile, auth, and the Radar assistant rail).
- **`Role Radar Mobile.dc.html`** — the installable **PWA**, which opens straight into the
  Radar bot (launch splash → live scanning sweep → conversational briefing), with a
  full-cockpit escape hatch.

## About the Design Files
The `.dc.html` files are **design references created in HTML** — interactive prototypes
that show the intended look, copy, and behavior. They are **not production code to copy**.
They open in any browser (self-contained; they load a small runtime + Google Fonts).

The task is to **recreate these designs in the target stack** described in
`ARCHITECTURE.md` — **React + TypeScript on AWS Amplify Gen 2** — using its established
patterns (Amplify Data/Auth/Functions, the AI Kit, a PWA build). Treat the inline-styled
HTML as the visual spec; implement with real components, the design tokens in `DESIGN.md`,
and the architecture in `ARCHITECTURE.md`. Where this README and those two files overlap,
**`DESIGN.md` is the source of truth for visual tokens and `ARCHITECTURE.md` for the
backend/AI/PWA build.**

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy, and interactions are all
intentional. Recreate the UI faithfully using the tokens in `DESIGN.md`. The prototypes use
mock/seed data and scripted bot replies; those stand in for real Amplify Data + AI Kit
calls (see `ARCHITECTURE.md`).

## Design system
See **`DESIGN.md`** (conforms to the `@google/design.md` spec — lintable with
`npx @google/design.md lint DESIGN.md`, exportable to Tailwind/DTCG tokens). In brief:
- **Aesthetic:** a calm, dense, *engineering/terminal* cockpit. Warm greige "paper & ink"
  neutrals; **monospace for every readout** (labels, scores, metadata, flags), sans for prose.
- **Type:** IBM Plex Sans (UI/body) + IBM Plex Mono (data/labels).
- **Three-signal palette:** green `#1E8A4F` = fit/match/go; gold `#B07D26` = hidden gem /
  reach; warm rust `#B0492B` = phantom / ineligible / risk. Never introduce other accents;
  never pure `#000`/`#fff`.
- Key tokens: paper `#F4F2EC`, surface `#FBFAF6`, panel `#EFECE4`, ink `#211E18`,
  muted `#6E685D`, border `#E4DFD4`. Rounding `sm6/md9/lg12/xl16/pill`. (Full scale + component
  tokens in `DESIGN.md`.)

## Screens / Views — desktop cockpit (`Role Radar.dc.html`)
Three-column shell: **sidebar nav** (panel) → **main column** (paper, scrolls) →
**assistant rail** (panel, the Radar bot + approval queue). Fixed top bar: view title +
last-run status + the green **Send scouts** action. Sidebar order: **Scouts · Hidden Gems ·
Recommended · Search · Pipeline**; Profile is reached only via the **user menu** at the
sidebar bottom.

- **Scouts** (the agent loop). Guardrail chips (*Never auto-applies · No outreach ·
  Canada-eligibility enforced · Every change needs your OK*); an agent-status card with a
  pulse dot, **autonomy dial** (Conservative/Balanced/Wide), Pause, and the loop pipeline
  (Scan → Reason → Expand → Surface → Learn); the live **sweep** (per-source progress +
  dedup/phantom/gem summary); a **discovery trace** (résumé strength → hypothesis → finds);
  and a pointer to the approval queue (which lives in the assistant rail).
- **Recommended** (signature view). Ranked role cards. Each shows: rank, title, company ·
  location · source · age, an **eligibility badge**, a **verdict pill** (MATCH / REACH /
  BELOW LEVEL / DOMAIN MISMATCH), a mono **fit score /100**, an **8-segment dimension meter**,
  reason chips, and a flag row (phantom risk with seen-count timeline, or ineligible).
  Expanding a card reveals the transparent **fit breakdown**: per-dimension gauges with
  plain-language notes, the honest verdict sentence, eligibility provenance + override, and
  actions (Add to pipeline / Open posting / Dismiss / **Mute company**). Filter/sort bar:
  fit|newest, Canada-eligible-only toggle, hide-below-level toggle.
- **Hidden Gems.** Gold-keyed cards distinguished from matches; each leads with *why it
  surfaced* (CONTENT MATCH — generic title, description full of the stack, with matched
  keyword chips; or COMPANY SIGNAL — Apple-heavy fleet) and **Confirm → promote** / Dismiss.
- **Search & watchlist** (single column, max-width ~660px). Grouped, weighted **search-term**
  cards, each with **its own add-term input** + remove (×) chips. **Company watchlist** rows
  (ATS provider tag, **pause/resume**, remove ×). **Excluded companies** (rust-tinted, with
  un-mute). **Active sources** toggles (Greenhouse/Lever/Ashby/Workday — watchlist-driven;
  Eluta/WWR/Remotive/Job Bank/Adzuna/Remote OK/HN — aggregate; LinkedIn — manual). A
  résumé-seeded banner.
- **Pipeline** (vertical). Stages stacked top→bottom (New → Interested → Applied → Interview
  → Offer → Closed); each is a band with a responsive card grid (collapses to one column on
  iPad/mobile). Cards: title, company, eligibility badge, **↑ move up / ↓ move down / ×
  remove**. Empty stages show "nothing here yet."
- **Profile.** Résumé textarea (the source of truth) + LinkedIn paste (manual). On parse:
  extracted **strengths** mapped to the fit dimensions (confidence pill incl. a gold "◆ RARE
  EDGE", adjustable **weight dots**, an evidence quote from the résumé), **suggested search
  terms** (add to Search), **suggested watchlist companies**, and **profile facts**
  (seniority, Winnipeg → Canada-eligible).
- **Auth gate** (Cognito). Sign in / Create account / 6-digit email confirm / forgot —
  centered card, "Secured by AWS Cognito".
- **Radar assistant rail.** Persistent right rail (collapsible to a launcher). Bot greeting,
  grounded replies, suggested-prompt chips, the **approval queue** as approve/dismiss cards,
  and a chat input. Header uses the **hat-glasses** mark.

## Screens / Views — mobile PWA (`Role Radar Mobile.dc.html`)
- **Launch splash** — green field, hat-glasses app icon, "RADAR / roleradar.bot / waking
  your scout… / INSTALLED · STANDALONE PWA".
- **Bot home** — opens with a **live scanning sweep** (radar circle + sources lighting up:
  Greenhouse ✓ / Lever ✓ / Ashby scanning…), then settles into a conversational briefing:
  greeting, sweep summary, a featured **match card**, **approval cards**, quick-reply chips,
  and a chat input. Header: hat-glasses + RADAR + live status, a **↻ replay sweep** button,
  and a **grid button** opening the **full-cockpit escape-hatch** bottom sheet (Recommended,
  Hidden gems, Pipeline, Search, Profile).

## Interactions & Behavior
- **Run a sweep** (desktop top bar / mobile launch): an async job; animate per-source
  progress, then dedup → fit → phantom → gem summary, then surface proposals. In production
  this is the Scout pipeline Lambda (see `ARCHITECTURE.md` §2) with progress via an AppSync
  subscription — **not** a fixed timer.
- **Fit reasoning** expand/collapse on each role card.
- **Approve / Dismiss** proposals (rail + mobile) mutate real state (add term, watch company,
  enable source, mute phantom). Approvals are the only thing that lets the bot act.
- **Mute company** removes all of a company's roles from results and adds it to Excluded;
  un-mute reverses it.
- **Pipeline** move ↑/↓ between stages; × removes.
- **Eligibility / fit / phantom are heuristic hints** — always shown with provenance and an
  easy override; never present as certainty.
- **Responsive:** desktop three-column; ≤820px the rails collapse and the experience is the
  mobile bot with a cockpit escape hatch. Touch targets ≥44px.

## State Management
Per-account (owner-scoped) data: `Profile` (résumé text + extracted strengths/weights),
`SearchConfig` (term groups + weights, watchlist `{company, provider, slug}`, excluded
companies, active sources), `Role` (normalized; stable `sourceId`, eligibility hint +
provenance, fit score + per-dimension breakdown + verdict, `seenCount`/`firstSeen`/`lastSeen`,
`pipelineStage`, notes), `Proposal` (kind, rationale, status), and the Radar conversation
(persisted history). UI state: current view, sweep phase/progress, autonomy level, expanded
card, filter toggles, assistant open/closed, chat input. See `ARCHITECTURE.md` for the model
+ AI tool wiring (read tools + **approval-gated** write tools).

## Design Tokens
Full set in **`DESIGN.md`** (YAML front-matter — colors, typography, rounded, spacing,
component tokens — plus rationale). Export for the build:
`npx @google/design.md export --format css-tailwind DESIGN.md > src/theme.css`.

## Assets
- **Icon — Radar:** Lucide **`hat-glasses`** (used verbatim, 24px / stroke-2). In production
  use `<HatGlasses/>` from `lucide-react`. Other glyphs are simple Unicode marks (◎ sweep,
  ◆/◇ nav, ↑/↓/× controls) — replace with Lucide equivalents as desired.
- **Fonts:** IBM Plex Sans + IBM Plex Mono (Google Fonts; self-host for the PWA).
- **PWA icons:** supply real PNGs under `/icons/` (192/512 + maskable) per `manifest.json`
  — the in-app mark is hat-glasses on green `#1E8A4F`.
- No other raster assets; role/company imagery is not used.

## Files in this bundle
- `Role Radar.dc.html` — desktop cockpit prototype (open in a browser).
- `Role Radar Mobile.dc.html` — mobile PWA prototype.
- `DESIGN.md` — design system (tokens + rationale; `@google/design.md` format).
- `ARCHITECTURE.md` — stack, source-adapter model, AI Kit, MCP, PWA, security, kickoff checklist.
- `manifest.json` — PWA web app manifest (starter).

## Build kickoff
Start from **`ARCHITECTURE.md` §7 (Kickoff checklist)**: scaffold Amplify Gen 2 (auth/data/
functions), implement the first source adapters (Greenhouse + Eluta) and the sweep Lambda,
add the AI conversation route (Radar) with read + approval-gated write tools and the
generation route for fit explanations, wire `vite-plugin-pwa` + `manifest.json`, and adopt
`DESIGN.md` tokens. Keep MCP behind a feature flag until the core sweep is solid.
