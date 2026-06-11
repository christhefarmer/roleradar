# Role Radar — `roleradar.bot`

A **private, single-user-per-account job-hunt cockpit**. The product persona is
**Radar**, a bot that dispatches **Scouts** across job sources, reasons about fit
against the owner's résumé, flags phantom/evergreen reposts, surfaces hidden gems,
and tracks roles through a pipeline — strictly **human-in-the-loop**: Radar
proposes, the owner approves; it never applies or contacts anyone.

Built from the design handoff in [`docs/design/`](docs/design/README.md)
(`DESIGN.md` is the visual source of truth, `ARCHITECTURE.md` the backend/AI/PWA
source of truth; the two `.dc.html` files are the interactive prototypes the UI
recreates).

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite, PWA via `vite-plugin-pwa` |
| Auth | Amplify Gen 2 Auth (Cognito) — email + code verification |
| Data | Amplify Data (AppSync + DynamoDB), owner-scoped models |
| Functions | Amplify Functions — the Scout sweep Lambda + source adapters |
| AI | Amplify AI Kit (Bedrock, Claude) — conversation route (Radar) + generation route (fit explanations) |
| Hosting | Amplify Hosting (`roleradar.bot`) |

## Run it

```bash
npm install
npm run dev        # design-fidelity mode: full UI on seed data, no AWS needed
npm run build      # typecheck + production build (PWA assets included)
npm run sandbox    # ampx sandbox — deploys the Amplify backend (needs AWS creds)
```

The app has two modes, switched automatically by the presence of
`amplify_outputs.json` (written by `ampx sandbox` locally or `ampx
pipeline-deploy` in Amplify Hosting):

- **Connected mode** (deployed): real Cognito sign-up/sign-in, an empty account
  created on first login, Profile/SearchConfig/Role/Proposal persistence in
  owner-scoped Amplify Data, the Scout sweep Lambda behind the `startSweep`
  mutation, AI résumé parsing + fit refinement, and the Radar chat streaming
  from the Bedrock conversation route.
- **Design-fidelity mode** (no outputs file): every view and interaction runs
  on the prototype seed (`src/data/seed.ts`) with scripted Radar replies —
  no AWS needed. This is local dev and design review.

**Going live checklist** (after a deploy):
1. Enable **Bedrock model access** for the configured Claude model in the
   app's region (Bedrock console → Model access) — the chat, résumé parse and
   AI fit reads need it; everything else degrades gracefully without it.
2. The sweep currently runs synchronously inside AppSync's 30s resolver cap —
   fine for a modest watchlist; the async-job + subscription upgrade is the
   documented next step (ARCHITECTURE.md §2).

- **Desktop** (>820px): the three-column cockpit — sidebar → main → assistant rail.
- **Mobile** (≤820px) or installed PWA (`/?source=pwa`): opens straight into the
  Radar bot (splash → live sweep → briefing), with the full-cockpit escape hatch.
- PWA shortcuts: `/?action=sweep` runs a sweep on launch, `/?view=queue` opens the
  approval queue.

## Layout

```
amplify/                 Gen 2 backend (code-only, reproducible from the repo)
  auth/resource.ts       Cognito: email + password, code verification
  data/resource.ts       Owner-scoped models + AI routes (chat / generateFit)
  functions/sweep/       The Scout pipeline Lambda
    adapters/            Pluggable source adapters (Greenhouse, Eluta, …)
src/
  theme.css              Design tokens exported from docs/design/DESIGN.md
  domain/types.ts        The common Role shape + per-account state types
  data/seed.ts           Prototype seed data (stands in for Amplify Data)
  state/store.tsx        App store — the seam where AppSync wiring lands
  components/ views/     The cockpit (Scouts, Gems, Recommended, Search, Pipeline, Profile)
  mobile/MobileBot.tsx   Bot-first mobile PWA experience
  auth/AuthGate.tsx      Sign in / sign up / confirm / forgot (mock → Cognito)
docs/design/             The design handoff bundle (source of truth)
scripts/make-icons.mjs   Generates the PWA icon set (runs automatically before build)
```

## Product invariants (enforced in code, not just prose)

- **Radar never acts alone.** Write operations exist only behind the approval
  queue (`Proposal` → explicit Approve). The AI conversation route gets *read*
  tools; approvals execute the writes.
- **Canada-eligibility is a hard default filter**; overrides are explicit,
  per-role, and reversible.
- **Eligibility / fit / phantom are heuristic hints** — always shown with
  provenance and a one-tap override, never as certainty.
- **No automated LinkedIn anything** — manual paste only.
- The **three-signal palette** (green = fit, gold = gem/reach, rust = risk) is
  never extended without updating `docs/design/DESIGN.md`.

## Kickoff checklist (ARCHITECTURE.md §7)

- [x] Scaffold Amplify Gen 2 (`amplify/` — auth, data, functions)
- [x] Define `Role`, `Profile`, `SearchConfig`, `Proposal`, `SweepRun` models with owner-based authz
- [x] First two adapters (Greenhouse + Eluta) + the sweep Lambda skeleton
- [x] AI conversation route (Radar) with read tools; writes gated behind the approval queue
- [x] Generation route for fit explanations (`generateFit`)
- [x] `vite-plugin-pwa` + manifest + maskable icons (placeholder renders — replace with final art)
- [x] `DESIGN.md` tokens adopted (`src/theme.css`)
- [x] Real auth (Cognito) + empty-account bootstrap + Profile/SearchConfig/Role/Proposal persistence
- [x] Sweep wired end-to-end (`startSweep` mutation → owner-side persistence → AI fit refinement)
- [x] Radar chat streaming from the AI Kit conversation route
- [ ] Async sweep job with live per-source progress over an AppSync subscription
- [ ] Watchlist slug resolution from pasted careers URLs (Greenhouse/Lever/Ashby/Workday)
- [ ] LinkedIn manual paste-in on-ramp (ARCHITECTURE.md §2 flow C)
- [ ] Self-host IBM Plex; `npx @google/design.md lint` in CI
- [ ] MCP stays behind a feature flag until the core sweep is solid (§4)
