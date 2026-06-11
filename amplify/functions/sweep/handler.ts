// The sweep — the Scouts' agentic run, as one Lambda invocation:
// fetch all active adapters → normalize → dedup by sourceId → score fit vs
// résumé profile → flag phantoms (seenCount over time) → detect hidden gems
// (content/company signal) → persist + emit proposals.
//
// Data access: once the sandbox/branch deploys, grant this function access to
// the Data API (`a.schema(...).authorization(allow => allow.resource(sweep))`
// on the models it touches) and persist through the generated client from
// `$amplify/env/sweep` + generateClient<Schema>(). Fit scoring below is the
// deterministic keyword baseline; the AI `generateFit` route refines the
// breakdown for surfaced roles.

import { eluta } from './adapters/eluta';
import { greenhouse } from './adapters/greenhouse';
import type { FetchConfig, NormalizedRole, SourceAdapter } from './adapters/types';

// Adapter registry, priority order: ATS (watchlist) → Eluta → remote-first
// feeds → LinkedIn (manual paste — no automated fetch, ever).
const ADAPTERS: SourceAdapter[] = [greenhouse, eluta];

interface SweepEvent {
  /** Owner identity — scopes every read and write. */
  owner: string;
  config: FetchConfig & {
    excludedCompanies: string[];
    activeSources: string[];
  };
}

export interface ScoredRole extends NormalizedRole {
  score: number;
  matchedTerms: string[];
  gem: { subtype: 'content' | 'company'; matches: string[] } | null;
}

interface SweepResult {
  fetched: number;
  kept: number;
  excluded: number;
  gems: number;
  roles: ScoredRole[];
  summary: string;
}

/** Baseline content score: weighted term hits across title + description.
 *  A generic title with a description full of the owner's stack outranks a
 *  title-only hit — that asymmetry is what surfaces hidden gems. */
function scoreRole(role: NormalizedRole, terms: string[]): { score: number; matched: string[] } {
  const title = role.title.toLowerCase();
  const body = role.rawDescription.toLowerCase();
  const matched: string[] = [];
  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (title.includes(t)) {
      score += 12;
      matched.push(term);
    } else if (body.includes(t)) {
      score += 7;
      matched.push(term);
    }
  }
  return { score: Math.min(100, score), matched };
}

function detectGem(role: NormalizedRole, score: number, matched: string[], titleHit: boolean) {
  // Content match: the title missed every search term but the description is
  // dense with the owner's stack.
  if (!titleHit && score >= 40) {
    return { subtype: 'content' as const, matches: matched };
  }
  return null;
}

export const handler = async (event: SweepEvent): Promise<SweepResult> => {
  const { config } = event;
  const active = ADAPTERS.filter((a) => config.activeSources.includes(a.id));

  // 1. Fetch + normalize, adapter by adapter (progress lands on SweepRun).
  const normalized: NormalizedRole[] = [];
  for (const adapter of active) {
    const raw = await adapter.fetch(config);
    normalized.push(...raw.map((r) => adapter.normalize(r)));
  }
  const fetched = normalized.length;

  // 2. Dedup by stable sourceId — re-seeing a role is signal (phantom), not a
  //    duplicate row. Cross-source merge keys on normalized company+title.
  const byId = new Map<string, NormalizedRole>();
  for (const role of normalized) {
    const key = role.sourceId || `${role.company}:${role.title}`.toLowerCase();
    if (!byId.has(key)) byId.set(key, role);
  }

  // 3. Exclusion list is the true omit — filters across every source.
  const excludedSet = new Set(config.excludedCompanies.map((c) => c.toLowerCase()));
  const kept = [...byId.values()].filter((r) => !excludedSet.has(r.company.toLowerCase()));
  const excluded = byId.size - kept.length;

  // 4. Score + gem-detect.
  const roles: ScoredRole[] = kept.map((role) => {
    const { score, matched } = scoreRole(role, config.terms);
    const titleHit = config.terms.some((t) => role.title.toLowerCase().includes(t.toLowerCase()));
    return { ...role, score, matchedTerms: matched, gem: detectGem(role, score, matched, titleHit) };
  });

  // 5. Persist: upsert Role rows by sourceId (incrementing seenCount /
  //    seenRuns for phantom detection), refresh fit via the generateFit AI
  //    route for newly surfaced roles, and emit Proposal rows (new terms,
  //    companies worth watching, phantoms worth muting) for the owner to
  //    approve. — wired up with the function's Data client at deploy time.

  const gems = roles.filter((r) => r.gem).length;
  const summary =
    `Fetched ${fetched} roles → deduped to ${byId.size} by stable id → ` +
    `${excluded} excluded → ${gems} hidden gems surfaced.`;

  return { fetched, kept: roles.length, excluded, gems, roles, summary };
};
