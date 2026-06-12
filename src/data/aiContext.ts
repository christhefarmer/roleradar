// Per-message grounding context for the Radar conversation. Built from the
// app state and sent as the AI Kit's `aiContext` alongside every message, so
// the model always sees the owner's live data without a tool round-trip.
// Pure module — takes a narrow structural input satisfied by AppState rather
// than importing the store (avoids a store → remote → store cycle).

import type {
  Gem,
  PipelineStageKey,
  Proposal,
  Role,
  SourceDef,
  Strength,
  SweepSummary,
  TermGroup,
  WatchEntry,
} from '../domain/types';
import type { ProfileFacts } from './remote';

export interface ChatContextInput {
  facts: ProfileFacts | null;
  strengths: Strength[];
  parsed: boolean;
  termGroups: TermGroup[];
  watchlist: WatchEntry[];
  watchPaused: Record<string, boolean>;
  excluded: string[];
  sources: SourceDef[];
  autonomy: string;
  summary: SweepSummary;
  roles: Role[];
  gems: Gem[];
  dismissed: Record<string, boolean>;
  overrides: Record<string, boolean>;
  canadaOnly: boolean;
  hideBelow: boolean;
  pipeline: Record<string, PipelineStageKey>;
  proposals: Proposal[];
  proposalState: Record<string, 'approved' | 'dismissed'>;
}

const trunc = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function snapshot(s: ChatContextInput, topRoles: number, topStrengths: number) {
  // Same visibility rules the Roles view applies — the model sees what the
  // owner sees.
  const visible = s.roles
    .filter((r) => !s.dismissed[r.id] && !s.excluded.includes(r.company))
    .filter(
      (r) =>
        !s.canadaOnly || r.elig.state === 'ca' || r.elig.state === 'remote' || s.overrides[r.id],
    )
    .filter((r) => !s.hideBelow || (r.verdict !== 'below' && r.verdict !== 'mismatch'));
  const top = [...visible]
    .sort((a, b) => b.score - a.score)
    .slice(0, topRoles)
    .map((r) => ({
      title: trunc(r.title),
      company: trunc(r.company),
      score: r.score,
      verdict: r.verdict,
      eligibility: r.elig.label,
      stage: s.pipeline[r.id] ?? 'none',
      posted: r.posted,
      ...(r.salary ? { salary: r.salary } : {}),
      ...(r.phantom ? { phantom: true } : {}),
    }));

  const pendingProposals = s.proposals.filter((p) => !s.proposalState[p.id]);

  return {
    generatedAt: new Date().toISOString(),
    profile: {
      facts: s.facts,
      parsed: s.parsed,
      strengths: s.strengths
        .slice(0, topStrengths)
        .map((st) => ({ label: st.label, confidence: st.conf, weight: st.weight })),
    },
    search: {
      termGroups: s.termGroups.map((g) => ({
        name: g.name,
        weight: g.weight,
        terms: g.terms.slice(0, 12),
      })),
      watchlist: s.watchlist.map((w) => w.name),
      paused: Object.keys(s.watchPaused).filter((k) => s.watchPaused[k]),
      excludedCompanies: s.excluded,
      activeSources: s.sources.filter((x) => x.on).map((x) => x.name),
      autonomy: s.autonomy,
    },
    lastSweep: s.summary,
    roles: {
      total: s.roles.length,
      visibleNow: visible.length,
      dismissed: Object.keys(s.dismissed).length,
      inPipeline: Object.keys(s.pipeline).length,
      undecidedGems: s.gems.length,
      top,
    },
    proposals: {
      pending: pendingProposals.length,
      items: pendingProposals.slice(0, 10).map((p) => ({ kind: p.kind, title: trunc(p.title, 90) })),
    },
  };
}

/** Build the aiContext payload, trimming until it stays a few KB — it rides
 *  on every message into the model's context window. */
export function buildChatContext(s: ChatContextInput): Record<string, unknown> {
  let ctx = snapshot(s, 10, 8);
  if (JSON.stringify(ctx).length > 8_000) ctx = snapshot(s, 5, 5);
  return ctx;
}
