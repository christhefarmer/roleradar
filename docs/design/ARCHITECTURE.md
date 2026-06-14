# Role Radar — Architecture & Engineering Practices

Foundation doc for kicking off the production app from a clean git. Pairs with
[`DESIGN.md`](./DESIGN.md) (visual identity) and [`manifest.json`](./manifest.json) (PWA).
Scope: a private, single-user-per-account job-hunt cockpit where **Radar** (a bot)
dispatches **Scouts** across job sources, reasons about fit against the owner's résumé,
flags phantom reposts, surfaces hidden gems, and tracks roles to close — all
human-in-the-loop.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React 18 + TypeScript + Vite** | PWA via `vite-plugin-pwa` (Workbox under the hood). |
| Auth | **Amplify Gen 2 Auth (Cognito)** | Email + password, email-code verification, optional Google federation. Per-account data isolation. |
| Data | **Amplify Data (AppSync + DynamoDB)** | Owner-based authorization — every record is scoped to its Cognito owner. |
| Functions | **Amplify Functions (Lambda)** | Source fetch/normalize, dedup, fit scoring, phantom detection. |
| AI | **Amplify AI Kit (Amazon Bedrock, Claude)** | Conversation route (Radar) + Generation route (fit explanations). |
| Hosting | **Amplify Hosting** | SPA rewrites; `roleradar.bot` apex. |

Everything is defined in TypeScript under `amplify/` (`amplify/backend.ts`,
`amplify/data/resource.ts`, `amplify/auth/resource.ts`, `amplify/functions/*`). No
console-clicked resources — the backend is reproducible from the repo.

**Principle:** the browser cannot fetch job-source feeds directly (CORS). All source
I/O happens server-side in Lambda; the client only ever talks to AppSync/Amplify Data.

---

## 2. Data model & the pluggable source-adapter architecture

Design the backend around **one common `Role` shape** that every source normalizes into.
A source is an *adapter* the backend knows how to fetch and map.

```
SourceAdapter (interface, server-side)
  id            "greenhouse" | "lever" | "ashby" | "workday" | "eluta" | "wwr" | "remotive" | "linkedin-manual"
  kind          "ats-json" | "rss" | "manual"
  scope         "watchlist" | "aggregate" | "manual"
  fetch(config) → RawPosting[]
  normalize(RawPosting) → Role
```

### No per-user credentials — the sources are open

A critical, cost-defining fact: **none of the automated sources require the owner to
authenticate.** There are no per-user API keys and no OAuth-per-source. Adapters split
into two flavors by `scope`:

**A. Watchlist-driven ATS adapters** — Greenhouse, Lever, Ashby, Workday.

These are **not accounts you log into.** They are public, no-auth board endpoints keyed by
a **company slug**. One shared adapter per ATS serves every user; the only per-user input
is *which companies* to ask:

```
Greenhouse  https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
Lever       https://api.lever.co/v0/postings/{slug}?mode=json
Ashby       https://api.ashbyhq.com/posting-api/job-board/{slug}
Workday     https://{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs   (POST)
```

So a watchlist entry is `{ company, provider, slug }` (Workday additionally needs
`{ tenant, dc, site }`). The sweep fans the relevant adapter out across the owner's
watchlist. **Per-user "configuration" is the watchlist itself — not credentials.**

*Slug resolution:* capture it at add-time. The owner pastes a careers URL and the backend
parses provider + slug from it (`boards.greenhouse.io/stripe` → Greenhouse / `stripe`;
`jobs.lever.co/figma` → Lever / `figma`; `jobs.ashbyhq.com/ramp` → Ashby / `ramp`). Workday
URLs yield the tenant/dc/site. Companies with no public ATS board fall back to aggregate
feeds or manual entry.

**B. Aggregate feed adapters** — Eluta.ca, We Work Remotely, Remotive.

These genuinely "pull from all of it": a **single public feed** queried with keywords/region,
**no per-company config — just on/off** (plus optional query terms). This is the firehose
that surfaces roles outside the watchlist.

**C. Manual** — LinkedIn. No automated pull (no compliant personal API; scraping risks the
owner's networking account). It is a **paste-in on-ramp**: roles the owner finds via
LinkedIn email alerts enter the *same* dedup → fit → phantom → pipeline flow as everything
the Scouts find automatically. LinkedIn is not a second-class list — only the *fetch* step
is done by a human, because compliance won't let a Scout do it.

Flow:

1. **Capture** — two entry points, both forgiving:
   - *Into Radar (the bot):* "Found this on LinkedIn: `<paste posting text or URL>`." Radar
     parses, scores, and replies with the fit read + "Add to pipeline?".
   - *"Add from LinkedIn" on the Search screen:* a small sheet with the job **URL** and/or
     the **posting text** (title, company, location, description).
2. **Parse → common `Role` shape** — extract title / company / location; keep the
   description body for content scoring. The pasted *text is the source of truth* (the full
   JD can't be reliably fetched server-side — LinkedIn blocks bots). URL-only paste captures
   title/company from the slug and prompts for the description to enable a real fit read.
3. **Stable id + dedup-merge** — build the id from the LinkedIn job id in the URL (else
   normalized `company+title`) so a paste **merges with the same role found on Greenhouse/
   Eluta** instead of duplicating; re-pasting is idempotent.
4. **Fit reasoning** — identical to any source (fit runs on description content vs. the
   résumé profile), so a generically-titled LinkedIn post can even surface as a hidden gem.
5. **Eligibility as a hint** — read from the pasted location text, shown with the same
   confirm/override badge; flagged, never assumed.
6. **Phantom signal still applies** — re-pastes increment `seenCount`; if the role also
   appears in automated sweeps, the phantom flag lights up across sources.
7. **Lands at New** in the pipeline, joins Recommended/Gems, and keeps the original LinkedIn
   URL for one-tap open / apply.

### What the Search-screen toggles mean

| Source | Per-user config | Toggle controls |
|---|---|---|
| Greenhouse / Lever / Ashby | the **watchlist** (company → slug, parsed from a URL) | query this ATS across the watchlist |
| Workday | watchlist + `{tenant, dc, site}` per company | query this ATS across the watchlist |
| Eluta / WWR / Remotive | none (optional keywords/region) | include this aggregate feed |
| LinkedIn | none | manual paste only |

There are **no credential fields** anywhere. ATS adapters are driven by the watchlist;
aggregate feeds are simple global on/off. Be a good citizen of the open endpoints: run
server-side on the sweep, cache responses, respect rate limits, and back off politely.

### Pausing & excluding companies

Two distinct controls, because they solve different problems:

- **Watchlist Pause / Remove** (per entry). *Remove* deletes the `{company, provider, slug}`
  entry so the ATS adapter no longer fetches it. *Pause* keeps the resolved slug but skips
  it on sweeps (a toggle) — for temporarily muting a noisy board without losing the lookup.
  Note: this only stops the **direct ATS pull**; the company can still surface via an
  aggregate feed if it posts there.
- **Excluded companies** (a per-user blocklist). For "never show me this company, from *any*
  source." It filters roles OUT at the dedup/fit stage — across watchlist, aggregate feeds,
  **and** manual paste — so it is the true "omit." One-tap **Mute company** from any role
  card; reversible from an *Excluded* list; and **Radar-proposable** (same pattern as
  mute-phantom: *"You've dismissed 3 roles from Acme — mute the company?"* → you approve).

Invariant: a company is never simultaneously on the watchlist and the excluded list.
Muting a watchlisted company moves it to Excluded (and stops its pull); un-muting returns it
to the watchlist as paused.

Adapter priority (highest-value first): **ATS (watchlist)** → **Eluta.ca** →
**remote-first feeds** → **LinkedIn (manual)**. The ATS sources rank highest because they
expose the **real location** — no eligibility guessing — which is the single biggest source
of noise for a Canada-eligible search.

### Source roadmap (candidate additions)

All normalize into the common `Role` shape and ride the same dedup → fit → eligibility →
phantom pipeline. Grouped by how cleanly they fit the no-auth / sanctioned lane:

**Canadian public sector — real Canadian locations, eligibility is trivial.**
- **Job Bank (jobbank.gc.ca)** — Government of Canada national board, sanctioned XML/data
  feed → *aggregate adapter*. Wide net; skews general, so it mostly feeds hidden-gems +
  eligibility confirmation rather than direct niche matches.
- **Federal & provincial public service** (GC Jobs; Manitoba, BC, Ontario, Alberta gov
  careers) and **universities / health authorities** (big Apple/endpoint fleets). Most run
  on **Workday / Taleo / SuccessFactors** — the *per-tenant ATS* pattern, so they belong on
  the **watchlist** as `{tenant, site}` entries, not as a global feed. (Manitoba gov + U of M
  are seeded in the watchlist as examples.)

**Sanctioned aggregator APIs — one app-level key, never per-user.**
- **Adzuna** — free permitted Jobs API with a Canada filter; aggregates many boards. The
  cleanest "search-engine-like" addition that stays compliant.
- The Muse (public API), Jooble / Careerjet (partner APIs) — secondary.

**Remote-first (beyond WWR / Remotive).**
- **Remote OK**, **Himalayas** (APIs), **Working Nomads** (RSS). Heavy US-remote noise —
  lean hard on the eligibility filter.

**High-signal niche.**
- **Hacker News "Who is hiring?"** monthly thread via the sanctioned **HN Algolia API** —
  low volume, strong for niche platform-eng roles; a good gem feeder.
- MacAdmins / Jamf Nation community posts → realistically **manual paste**.

**Search engines — manual-only (no compliant search API).**
- **Google Jobs** (Cloud Talent is employer-side, not search), **Indeed** (publisher API
  largely deprecated; scraping is ToS-restricted), **Glassdoor** (no open jobs API). These
  ride the same paste-in on-ramp as LinkedIn rather than becoming Scouts.

First expansion to implement: **Job Bank** + **Adzuna** (aggregate) + **provincial/Manitoba
gov & universities** (watchlist ATS) + **HN Who-is-hiring** (gem feeder). More sources means
more volume, not more noise — the fit + eligibility + dedup pipeline is what makes a wide net safe.

Core `Role` fields: stable `sourceId` (for dedup across runs), title, company, location,
rawDescription, `eligibility` (hint + provenance), `fit` (score + per-dimension breakdown +
verdict), `seenCount` / `firstSeen` / `lastSeen` (phantom signal), `pipelineStage`, notes.

**The Scout pipeline** (one Lambda run, the agentic "sweep"):
`fetch all active adapters → normalize → dedup by sourceId → score fit vs résumé profile
→ flag phantoms (seenCount over time) → detect hidden gems (content/company signal) →
persist + emit proposals`. Make it an **async job** with progress the client can poll/
subscribe to (AppSync subscription) — the run/sweep UX is built around a server call that
takes a little time across several sources.

**Eligibility & fit are heuristic.** Persist them with provenance ("Greenhouse location
field: 'Canada (Remote)'") and treat them as hints the owner confirms or overrides —
never as hard truth.

---

## 3. AI — Amplify AI Kit (Bedrock / Claude)

Two routes, defined in `amplify/data/resource.ts`.

### Conversation route — "Radar" (the bot)
`a.ai.conversation(...)` backs the assistant rail (desktop) and the mobile home. It is
multi-turn, streaming, and persists history per owner. Surface it with `useAIConversation`
(Amplify UI React) — do not hand-roll the transport.

- **System prompt** is assembled from the owner's **résumé-derived profile** (strengths +
  weights), the active search config, and a short style guide drawn from `DESIGN.md`. This
  is what makes answers grounded in *this* person, not generic.
- **Tools** are the leverage. Give the conversation:
  - **Read tools** over Amplify Data — `listTopMatches`, `getRole`, `listPhantoms`,
    `listGems`, `listProposals`, `pipelineStatus`. The bot answers from real records.
  - **Write tools, approval-gated** — `addSearchTerm`, `watchCompany`, `enableSource`,
    `mutePhantom`, `setPipelineStage`. These execute **only after an explicit in-chat
    Approve**. The model may *propose*; the human confirms. This keeps the
    human-in-the-loop guarantee intact even as the bot becomes more capable.
- **Model:** a current Claude model on Bedrock. Keep model id in config; allow upgrade.
- **Streaming** on; render tokens as they arrive.

### Generation route — fit explanations
`a.ai.generation(...)` returns a **structured** fit object per role (per-dimension
hit/partial/thin + the plain-language verdict sentence + what's thin/missing). This powers
the signature "fit-with-reasoning" card. One-shot, typed output — not a chat.

### Guardrails (non-negotiable, enforce in code, not just prose)
- Radar **never applies, never messages anyone, never changes search/state without a yes.**
- Canada-eligibility is a hard client filter by default; overrides are explicit and per-role.
- No automated LinkedIn anything.

---

## 4. MCP — optional augmentation layer, not the core path

Model Context Protocol is **later and optional** (per product intent). The foundational
sources stay direct backend fetches; MCP never sits on the critical path of a sweep.

Two viable directions when the time comes:

1. **Role Radar *as* an MCP server.** Expose a small, read-mostly toolset
   (`search_roles`, `explain_fit`, `list_phantoms`, `pipeline_status`) so the owner can
   triage from an MCP-capable client (e.g. Claude Desktop) without leaving their chat.
   - Transport: **streamable HTTP** (the current remote-MCP transport), behind
     **OAuth 2.1** (reuse Cognito as the IdP). Never ship an unauthenticated remote server.
   - Mirror the in-app guardrails: expose *read* + *propose* tools; gate any *write* behind
     an explicit confirmation, same as the in-app queue.
2. **Role Radar *consuming* MCP connectors** for a conversational-triage layer — optional
   enrichment (e.g. a company-research connector), surfaced as Scout proposals the owner approves.

Treat MCP as a clean, versioned boundary: the same tool contracts the in-app AI uses,
re-exposed. Keep it behind a feature flag until the core sources are solid.

---

## 5. PWA — installable, offline-capable

Goal: `roleradar.bot` installs to the home screen and **launches straight into the cockpit**
on phones, with Radar one tap away in the assistant rail.

- **Manifest** — [`manifest.json`](./manifest.json): `display: standalone`, portrait,
  `theme_color`/`background_color` `#1E8A4F`, **maskable** icons (192/512), and **app
  shortcuts** (*Run a sweep*, *Review proposals*). Provide real PNG icons under
  `/icons/` (the in-app mark is the Lucide `hat-glasses` glyph on green).
- **Service worker** — generate with **`vite-plugin-pwa` + Workbox**. Caching strategy:
  - **App shell / static assets:** precache + cache-first (instant offline launch).
  - **Data (AppSync queries):** network-first with a short cache fallback so an offline
    open still shows the last briefing.
  - Use `registerType: 'autoUpdate'` and prompt on new version.
- **Responsive cockpit:** desktop and mobile render the same three-column cockpit; on
  ≤820px the sidebar collapses to a hamburger top-nav and the assistant rail to an
  "Ask Radar" launcher. Radar is opened on demand from the rail — there is no separate
  bot-first mobile landing. Deep links still target the cockpit views (`/scout`,
  `/recommended`, `/pipeline`, …).
- **Launch feel:** play the live "Scouts on patrol…" sweep on cold start, then settle into
  the briefing — wire its progress to the real async sweep job, not a fixed timer.
- **iOS niceties:** `apple-mobile-web-app-capable`, status-bar style, and an apple-touch-icon;
  test "Add to Home Screen" in Safari.

---

## 6. Security, privacy & authorization

- **Per-account isolation:** owner-based auth on every Data model; a user only ever reads/
  writes their own roles, profile, search config, and conversations.
- **Secrets:** any source API keys / model config via Amplify secrets + environment, never
  in the client bundle.
- **Résumé & LinkedIn text** are the owner's private data — stored per-owner, used only to
  build the AI system prompt and fit scoring. Make deletion/edit trivial (the Profile screen).
- **Heuristic honesty:** eligibility/fit/phantom are best-effort. The UI must always present
  them as hints with provenance and one-tap override.

---

## 7. Kickoff checklist (clean git)

- [ ] `npm create amplify@latest` — scaffold `amplify/` (auth, data, functions).
- [ ] Define `Role`, `Profile`, `SearchConfig`, `SourceConfig`, `Proposal`, conversation
      models with owner-based authz.
- [ ] Implement the first two adapters (Greenhouse + Eluta) + the sweep Lambda.
- [ ] Add the AI conversation route (Radar) with read tools; gate write tools behind approval.
- [ ] Add the generation route for fit explanations.
- [ ] Wire `vite-plugin-pwa`; ship `manifest.json` + real maskable icons; verify install.
- [ ] Adopt `DESIGN.md`: export tokens for the build —
      `npx @google/design.md export --format css-tailwind DESIGN.md > src/theme.css`
      (or `--format dtcg` for a tokens pipeline). Keep `DESIGN.md` the source of truth and
      `npx @google/design.md lint DESIGN.md` in CI.
- [ ] Defer MCP behind a feature flag until the core sweep is solid.

---

## 8. Conventions

- Backend is code (`amplify/`), reviewed like app code. No console-only resources.
- One common `Role` shape; sources are adapters behind it.
- AI proposes; the human approves. This is a product invariant, enforced in tool wiring.
- `DESIGN.md` is the visual source of truth; the UI consumes exported tokens, and the
  three-signal palette (green/gold/rust) is never extended without updating `DESIGN.md`.
