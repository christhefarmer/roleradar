// The sweep — the Scouts' agentic run, invoked as the `startSweep` mutation
// handler: fetch all active adapters → normalize → dedup by sourceId → score
// vs the owner's terms → detect hidden gems → return scored postings. The
// client persists them into owner-scoped Role rows (so every write stays
// inside the owner's authorization) and runs the AI fit refinement on the
// top matches via the `generateFit` route.
//
// v1 is synchronous and must finish inside AppSync's 30s resolver window —
// fine for a modest watchlist. The upgrade path (ARCHITECTURE.md §2) is an
// async job writing per-source progress to SweepRun behind a subscription.

import { ashby } from './adapters/ashby';
import { bamboohr } from './adapters/bamboohr';
import { eluta } from './adapters/eluta';
import { greenhouse } from './adapters/greenhouse';
import { lever } from './adapters/lever';
import { linkedinApify } from './adapters/linkedinApify';
import { smartrecruiters } from './adapters/smartrecruiters';
import { workable } from './adapters/workable';
import { workday } from './adapters/workday';
import type { NormalizedRole, SourceAdapter, WatchlistEntry } from './adapters/types';

// Adapter registry, priority order: ATS (watchlist) → aggregates.
// LinkedIn rides Apify's public-listings actor — never the owner's account.
const ADAPTERS: SourceAdapter[] = [
  greenhouse,
  lever,
  ashby,
  workable,
  workday,
  smartrecruiters,
  bamboohr,
  eluta,
  linkedinApify,
];

interface SweepConfig {
  terms: string[];
  /** Tier weight per lowercased term (High 3 / Med 2 / Low 1); default 2. */
  weights: Record<string, number>;
  watchlist: WatchlistEntry[];
  excludedCompanies: string[];
  /** Adapter ids toggled on in Search → Active sources. */
  activeSources: string[];
}

/** AppSync direct-Lambda resolver event for the startSweep mutation. */
interface SweepEvent {
  arguments: { config: unknown };
  identity?: { sub?: string };
}

export interface ScoredRole extends NormalizedRole {
  score: number;
  matchedTerms: string[];
  titleHit: boolean;
  gem: { subtype: 'content' | 'company'; matches: string[] } | null;
}

export interface SweepResult {
  fetched: number;
  deduped: number;
  excluded: number;
  kept: number;
  gems: number;
  perSource: { id: string; count: number }[];
  roles: ScoredRole[];
  summary: string;
}

/** Baseline content score: tier-weighted term hits across title + description.
 *  A generic title with a description full of the owner's stack outranks a
 *  title-only hit — that asymmetry is what surfaces hidden gems. The AI
 *  `generateFit` route refines the per-dimension read for surfaced roles. */
function scoreRole(
  role: NormalizedRole,
  terms: string[],
  weights: Record<string, number>,
): { score: number; matched: string[]; titleHit: boolean } {
  const title = role.title.toLowerCase();
  const body = role.rawDescription.toLowerCase();
  const matched: string[] = [];
  let score = 0;
  let titleHit = false;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (!t) continue;
    const w = weights[t] ?? 2;
    if (title.includes(t)) {
      score += 6 * w;
      titleHit = true;
      matched.push(term);
    } else if (body.includes(t)) {
      score += 3.5 * w;
      matched.push(term);
    }
  }
  return { score: Math.min(100, Math.round(score)), matched, titleHit };
}

export const handler = async (event: SweepEvent): Promise<string> => {
  // AWSJSON arguments can arrive wrapped in one or more string layers
  // depending on which side serialized them — unwrap until non-string.
  let raw: unknown = event.arguments?.config;
  for (let i = 0; i < 3 && typeof raw === 'string'; i++) {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  const config: SweepConfig = {
    terms: [],
    weights: {},
    watchlist: [],
    excludedCompanies: [],
    activeSources: ['greenhouse', 'lever', 'ashby', 'eluta'],
    ...(typeof raw === 'object' && raw !== null ? (raw as Partial<SweepConfig>) : {}),
  };

  const active = ADAPTERS.filter((a) => config.activeSources.includes(a.id));

  // 1. Fetch + normalize, adapter by adapter.
  const normalized: NormalizedRole[] = [];
  const perSource: { id: string; count: number }[] = [];
  for (const adapter of active) {
    const rawPostings = await adapter.fetch({ terms: config.terms, watchlist: config.watchlist });
    perSource.push({ id: adapter.id, count: rawPostings.length });
    normalized.push(...rawPostings.map((r) => adapter.normalize(r)));
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
  const keptRoles = [...byId.values()].filter((r) => !excludedSet.has(r.company.toLowerCase()));
  const excluded = byId.size - keptRoles.length;

  // 4. Score + gem-detect (content match: title missed every term but the
  //    description is dense with the owner's stack).
  const watchSet = new Set(config.watchlist.map((w) => w.company.toLowerCase()));
  const roles: ScoredRole[] = keptRoles
    .map((role) => {
      const { score, matched, titleHit } = scoreRole(role, config.terms, config.weights ?? {});
      const gem =
        !titleHit && score >= 40
          ? { subtype: 'content' as const, matches: matched }
          : !titleHit && score >= 25 && watchSet.has(role.company.toLowerCase())
            ? { subtype: 'company' as const, matches: matched }
            : null;
      return { ...role, score, matchedTerms: matched, titleHit, gem };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    // Keep the response well inside AppSync's payload limits.
    .slice(0, 80)
    .map((r) => ({ ...r, rawDescription: r.rawDescription.slice(0, 4000) }));

  const gems = roles.filter((r) => r.gem).length;
  const result: SweepResult = {
    fetched,
    deduped: byId.size,
    excluded,
    kept: roles.length,
    gems,
    perSource,
    roles,
    summary:
      `Fetched ${fetched} roles → deduped to ${byId.size} by stable id → ` +
      `${excluded} excluded → ${roles.length} kept → ${gems} hidden gems surfaced.`,
  };

  // AWSJSON return — serialize once here; the client parses defensively.
  return JSON.stringify(result);
};
