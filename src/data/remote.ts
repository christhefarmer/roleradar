// Connected-mode data layer: Amplify Data (AppSync + DynamoDB) behind the
// same shapes the store already uses. Every record is owner-scoped — all
// writes happen here in the signed-in user's authorization context, which is
// also why the sweep Lambda *returns* postings instead of writing them: the
// client persists, so nothing ever lands outside the owner's account.

import type {
  ChipTone,
  DimKey,
  DimState,
  Gem,
  PipelineStageKey,
  Proposal,
  Role,
  SourceDef,
  Strength,
  SuggestedCompany,
  SuggestedTerm,
  SweepSummary,
  TermGroup,
  VerdictKey,
  WatchEntry,
} from '../domain/types';
import { client } from '../lib/amplify';

// ---------------------------------------------------------------------------
// Shapes shared with the backend

interface FitJson {
  score: number;
  verdict: VerdictKey;
  sentence: string;
  dims: Record<DimKey, DimState>;
  notes: Partial<Record<DimKey, string>>;
  chips: [string, ChipTone][];
  /** 'baseline' (keyword scorer) or 'ai' (generateFit refinement). */
  source: 'baseline' | 'ai';
}

interface ScoredRoleWire {
  sourceId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  rawDescription: string;
  sourceName: string;
  eligibility: { state: 'ca' | 'us' | 'unknown'; label: string; detail: string };
  score: number;
  matchedTerms: string[];
  titleHit: boolean;
  gem: { subtype: 'content' | 'company'; matches: string[] } | null;
}

interface SweepResultWire {
  fetched: number;
  deduped: number;
  excluded: number;
  kept: number;
  gems: number;
  perSource: { id: string; count: number }[];
  roles: ScoredRoleWire[];
  summary: string;
}

export interface AccountSnapshot {
  termGroups: TermGroup[];
  watchlist: WatchEntry[];
  watchPaused: Record<string, boolean>;
  excluded: string[];
  sources: SourceDef[];
  autonomy: 'conservative' | 'balanced' | 'wide';
  resumeText: string;
  linkedinText: string;
  parsed: boolean;
  weights: Record<string, number>;
  strengths: Strength[];
  sugTerms: SuggestedTerm[];
  sugCos: SuggestedCompany[];
  facts: ProfileFacts | null;
  roles: Role[];
  gems: Gem[];
  pipeline: Record<string, PipelineStageKey>;
  dismissed: Record<string, boolean>;
  overrides: Record<string, boolean>;
  gemDecisions: Record<string, 'confirmed' | 'dismissed'>;
  proposals: Proposal[];
  proposalState: Record<string, 'approved' | 'dismissed'>;
  summary: SweepSummary;
}

export interface ProfileFacts {
  seniority?: string;
  location?: string;
  canadaEligible?: boolean;
}

// Record ids for the two singleton aggregates, cached for the session.
let profileId: string | null = null;
let searchConfigId: string | null = null;

/** Default config for a brand-new (empty) account: the four canonical term
 *  groups, aggregate feeds on, nothing watched or excluded yet. */
const DEFAULT_GROUPS: TermGroup[] = [
  { name: 'Apple / endpoint', weight: 3, terms: [] },
  { name: 'Cross-platform / EUC', weight: 2, terms: [] },
  { name: 'Identity & security', weight: 2, terms: [] },
  { name: 'Client-facing', weight: 2, terms: [] },
];

const DEFAULT_SOURCES: SourceDef[] = [
  { name: 'Greenhouse', note: 'ATS JSON · watchlist companies', tag: 'ACTIVE', on: true },
  { name: 'Lever', note: 'ATS JSON · watchlist companies', tag: 'OFF', on: false },
  { name: 'Ashby', note: 'ATS JSON · watchlist companies', tag: 'OFF', on: false },
  { name: 'Workday', note: 'ATS JSON · watchlist companies', tag: 'OFF', on: false },
  { name: 'Eluta.ca', note: 'Sanctioned RSS / OpenSearch · Canada', tag: 'ACTIVE', on: true },
  { name: 'LinkedIn', note: 'Manual — paste roles from email alerts', tag: 'MANUAL', on: true },
];

/** Adapter ids actually implemented server-side (ARCHITECTURE.md roadmap
 *  grows this list); the UI may show more toggles than are live. */
const SOURCE_ADAPTER_IDS: Record<string, string> = {
  Greenhouse: 'greenhouse',
  'Eluta.ca': 'eluta',
};

const GROUP_DIMS: DimKey[][] = [['macos'], ['intune'], ['identity', 'security'], ['client']];

// ---------------------------------------------------------------------------
// Mapping: backend Role row → UI Role / Gem

type RoleRow = {
  id: string;
  sourceId: string;
  title: string;
  company: string;
  location?: string | null;
  url?: string | null;
  sourceName?: string | null;
  rawDescription?: string | null;
  eligibility?: unknown;
  eligibilityOverridden?: boolean | null;
  fit?: unknown;
  seenCount?: number | null;
  firstSeen?: string | null;
  lastSeen?: string | null;
  seenRuns?: (boolean | null)[] | null;
  phantomMuted?: boolean | null;
  gem?: unknown;
  gemDecision?: 'pending' | 'confirmed' | 'dismissed' | null;
  pipelineStage?: string | null;
  dismissed?: boolean | null;
  notes?: string | null;
};

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function daysBetween(a: string | null | undefined, b: Date): number {
  if (!a) return 0;
  return Math.max(0, Math.floor((b.getTime() - new Date(a).getTime()) / 86_400_000));
}

const EMPTY_DIMS: Record<DimKey, DimState> = {
  macos: 'na',
  intune: 'na',
  identity: 'na',
  security: 'na',
  build: 'na',
  client: 'na',
  level: 'na',
  eligible: 'na',
};

function rowToUiRole(row: RoleRow): Role {
  const fit = parseJsonField<FitJson | null>(row.fit, null);
  const elig = parseJsonField<{ state: 'ca' | 'us' | 'unknown'; label: string; detail?: string }>(
    row.eligibility,
    { state: 'unknown', label: 'CHECK ✻' },
  );
  const seen = row.seenCount ?? 1;
  const ageDays = daysBetween(row.firstSeen, new Date());
  const phantom =
    seen >= 4 && ageDays >= 30 && !row.phantomMuted
      ? {
          seen,
          days: ageDays,
          runs: (row.seenRuns ?? []).map((r) => !!r).slice(-8),
        }
      : undefined;
  const verdict = fit?.verdict ?? 'reach';
  return {
    id: row.id,
    recordId: row.id,
    title: row.title,
    company: row.company,
    location: row.location ?? '',
    posted: seen > 3 ? `seen ${ageDays}d` : `${ageDays}d`,
    days: ageDays,
    source: row.sourceName ?? '',
    url: row.url ?? undefined,
    score: fit?.score ?? 0,
    verdict,
    dims: { ...EMPTY_DIMS, ...(fit?.dims ?? {}) },
    notes: fit?.notes ?? {},
    chips: fit?.chips ?? [],
    sentence: fit?.sentence ?? 'No fit read yet — run a sweep to score this role.',
    elig: {
      state: elig.state === 'us' ? 'us' : 'ca',
      label: elig.label,
      detail: elig.detail,
    },
    phantom,
    down: verdict === 'below' || verdict === 'mismatch',
  };
}

function rowToUiGem(row: RoleRow): Gem | null {
  const gem = parseJsonField<{ subtype: 'content' | 'company'; matches: string[] } | null>(
    row.gem,
    null,
  );
  if (!gem) return null;
  const fit = parseJsonField<FitJson | null>(row.fit, null);
  const elig = parseJsonField<{ state: 'ca' | 'us' | 'unknown'; label: string }>(row.eligibility, {
    state: 'unknown',
    label: 'CHECK ✻',
  });
  const n = gem.matches.length;
  return {
    id: row.id,
    recordId: row.id,
    title: row.title,
    company: row.company,
    location: row.location ?? '',
    source: row.sourceName ?? '',
    subtype: gem.subtype === 'company' ? 'COMPANY SIGNAL' : 'CONTENT MATCH',
    fit: fit?.score ?? 0,
    whyLabel:
      gem.subtype === 'company'
        ? 'WHY IT SURFACED — COMPANY FLEET SIGNAL'
        : 'WHY IT SURFACED — TITLE MISSED YOUR TERMS',
    whyText:
      gem.subtype === 'company'
        ? `A broad title at ${row.company} — a company on your watchlist — whose description still matched ${n} of your terms.`
        : `None of your search terms appear in this title, so a title search skips it — but the description matched ${n} of them.`,
    matches: gem.matches,
    elig: { state: elig.state === 'us' ? 'us' : 'ca', label: elig.label },
  };
}

// ---------------------------------------------------------------------------
// Account bootstrap + hydration

async function listAllRoles(): Promise<RoleRow[]> {
  const rows: RoleRow[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await client().models.Role.list({ limit: 500, nextToken });
    rows.push(...((res.data ?? []) as unknown as RoleRow[]));
    nextToken = res.nextToken;
  } while (nextToken);
  return rows;
}

/** Load the owner's account; create the empty Profile + default SearchConfig
 *  on first sign-in so a brand-new user lands in a clean, populatable state. */
export async function loadAccount(): Promise<AccountSnapshot> {
  const c = client();

  const [profileRes, configRes] = await Promise.all([
    c.models.Profile.list({ limit: 1 }),
    c.models.SearchConfig.list({ limit: 1 }),
  ]);

  const profile =
    profileRes.data[0] ??
    (await c.models.Profile.create({ resumeText: '', linkedinText: '' })).data;
  profileId = profile?.id ?? null;

  const config =
    configRes.data[0] ??
    (
      await c.models.SearchConfig.create({
        termGroups: JSON.stringify(DEFAULT_GROUPS),
        watchlist: JSON.stringify([]),
        pausedCompanies: [],
        excludedCompanies: [],
        activeSources: JSON.stringify(DEFAULT_SOURCES),
        autonomy: 'balanced',
      })
    ).data;
  searchConfigId = config?.id ?? null;

  const [roleRows, proposalRes, runRes] = await Promise.all([
    listAllRoles(),
    c.models.Proposal.list({ limit: 200 }),
    c.models.SweepRun.list({ limit: 50 }),
  ]);

  const strengthsRaw = parseJsonField<{
    strengths?: Strength[];
    sugTerms?: SuggestedTerm[];
    sugCos?: SuggestedCompany[];
  }>(profile?.strengths, {});
  const facts = parseJsonField<ProfileFacts | null>(profile?.facts, null);

  const roles: Role[] = [];
  const gems: Gem[] = [];
  const pipeline: Record<string, PipelineStageKey> = {};
  const dismissed: Record<string, boolean> = {};
  const overrides: Record<string, boolean> = {};
  const gemDecisions: Record<string, 'confirmed' | 'dismissed'> = {};
  for (const row of roleRows) {
    const ui = rowToUiRole(row);
    roles.push(ui);
    const gem = rowToUiGem(row);
    if (gem && row.gemDecision !== 'dismissed') gems.push(gem);
    if (row.gemDecision === 'confirmed' || row.gemDecision === 'dismissed')
      gemDecisions[row.id] = row.gemDecision;
    if (row.pipelineStage && row.pipelineStage !== 'none')
      pipeline[row.id] = row.pipelineStage as PipelineStageKey;
    if (row.dismissed) dismissed[row.id] = true;
    if (row.eligibilityOverridden) overrides[row.id] = true;
  }

  const proposals: Proposal[] = [];
  const proposalState: Record<string, 'approved' | 'dismissed'> = {};
  for (const p of proposalRes.data ?? []) {
    proposals.push({
      id: p.id,
      recordId: p.id,
      kind: kindLabel(p.kind ?? 'mutePhantom'),
      tone: p.kind === 'mutePhantom' ? 'bad' : 'good',
      title: p.title,
      rationale: p.rationale,
      ok: p.resolvedNote ?? 'Approved.',
      payload: parseJsonField<Record<string, string>>(p.payload, {}),
    });
    if (p.status === 'approved' || p.status === 'dismissed') proposalState[p.id] = p.status;
  }

  const runs = (runRes.data ?? [])
    .slice()
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const latest = runs[0];
  const summary: SweepSummary = latest
    ? {
        fetched: latest.fetched ?? 0,
        kept: latest.kept ?? 0,
        phantoms: latest.phantoms ?? 0,
        gems: latest.gems ?? 0,
        when: `${daysAgoLabel(latest.createdAt)}`,
      }
    : { fetched: 0, kept: 0, phantoms: 0, gems: 0, when: 'never' };

  const termGroups = parseJsonField<TermGroup[]>(config?.termGroups, DEFAULT_GROUPS);
  const watchlist = parseJsonField<WatchEntry[]>(config?.watchlist, []);
  const watchPaused: Record<string, boolean> = {};
  for (const name of config?.pausedCompanies ?? []) if (name) watchPaused[name] = true;

  return {
    termGroups,
    watchlist,
    watchPaused,
    excluded: (config?.excludedCompanies ?? []).filter((x): x is string => !!x),
    sources: parseJsonField<SourceDef[]>(config?.activeSources, DEFAULT_SOURCES),
    autonomy: (config?.autonomy as AccountSnapshot['autonomy']) ?? 'balanced',
    resumeText: profile?.resumeText ?? '',
    linkedinText: profile?.linkedinText ?? '',
    parsed: (strengthsRaw.strengths?.length ?? 0) > 0,
    weights: {},
    strengths: strengthsRaw.strengths ?? [],
    sugTerms: strengthsRaw.sugTerms ?? [],
    sugCos: strengthsRaw.sugCos ?? [],
    facts,
    roles,
    gems,
    pipeline,
    dismissed,
    overrides,
    gemDecisions,
    proposals,
    proposalState,
    summary,
  };
}

function daysAgoLabel(iso?: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function kindLabel(kind: string): string {
  return (
    {
      expandSearch: 'EXPAND SEARCH',
      addCompany: 'ADD COMPANY',
      addSource: 'ADD SOURCE',
      tuneWeight: 'TUNE WEIGHT',
      autonomy: 'AUTONOMY',
      mutePhantom: 'MUTE PHANTOM',
    }[kind] ?? kind.toUpperCase()
  );
}

// ---------------------------------------------------------------------------
// Persistence

export interface SearchConfigState {
  termGroups: TermGroup[];
  watchlist: WatchEntry[];
  watchPaused: Record<string, boolean>;
  excluded: string[];
  sources: SourceDef[];
  autonomy: 'conservative' | 'balanced' | 'wide';
}

export async function saveSearchConfig(s: SearchConfigState): Promise<void> {
  if (!searchConfigId) return;
  await client().models.SearchConfig.update({
    id: searchConfigId,
    termGroups: JSON.stringify(s.termGroups),
    watchlist: JSON.stringify(s.watchlist),
    pausedCompanies: Object.keys(s.watchPaused).filter((k) => s.watchPaused[k]),
    excludedCompanies: s.excluded,
    activeSources: JSON.stringify(s.sources),
    autonomy: s.autonomy,
  });
}

export interface ProfileState {
  resumeText: string;
  linkedinText: string;
  strengths: Strength[];
  sugTerms: SuggestedTerm[];
  sugCos: SuggestedCompany[];
  facts: ProfileFacts | null;
}

export async function saveProfile(p: ProfileState): Promise<void> {
  if (!profileId) return;
  await client().models.Profile.update({
    id: profileId,
    resumeText: p.resumeText,
    linkedinText: p.linkedinText,
    strengths: JSON.stringify({
      strengths: p.strengths,
      sugTerms: p.sugTerms,
      sugCos: p.sugCos,
    }),
    facts: p.facts ? JSON.stringify(p.facts) : undefined,
    parsedAt: new Date().toISOString(),
  });
}

export async function saveRolePatch(
  recordId: string,
  patch: {
    pipelineStage?: string;
    dismissed?: boolean;
    eligibilityOverridden?: boolean;
    gemDecision?: 'pending' | 'confirmed' | 'dismissed';
    phantomMuted?: boolean;
  },
): Promise<void> {
  await client().models.Role.update({
    id: recordId,
    ...(patch as Record<string, never>),
  });
}

export async function saveProposalStatus(
  recordId: string,
  status: 'approved' | 'dismissed',
  resolvedNote?: string,
): Promise<void> {
  await client().models.Proposal.update({ id: recordId, status, resolvedNote });
}

// ---------------------------------------------------------------------------
// Profile parse (AI generation route, with a plain heuristic fallback)

export interface ParseOutcome {
  strengths: Strength[];
  sugTerms: SuggestedTerm[];
  sugCos: SuggestedCompany[];
  facts: ProfileFacts | null;
}

export async function parseProfileRemote(
  resumeText: string,
  linkedinText: string,
): Promise<ParseOutcome> {
  try {
    const res = await client().generations.parseProfile({ resumeText, linkedinText });
    const data = res.data;
    if (!data) throw new Error(res.errors?.[0]?.message ?? 'empty parse result');
    const strengths = parseJsonField<Strength[]>(data.strengths, []).map(
      (s): Strength => ({
        key: s.key ?? s.label,
        label: s.label,
        conf: s.conf === 'RARE' || s.conf === 'MED' ? s.conf : 'HIGH',
        weight: Math.min(3, Math.max(1, Number(s.weight) || 2)),
        bar: Math.min(100, Math.max(10, Number(s.bar) || 60)),
        ev: s.ev ?? '',
      }),
    );
    return {
      strengths,
      sugTerms: (data.suggestedTerms ?? [])
        .filter((t): t is string => !!t)
        .map((label) => ({ label, added: false })),
      sugCos: parseJsonField<SuggestedCompany[]>(data.suggestedCompanies, []),
      facts: parseJsonField<ProfileFacts | null>(data.facts, null),
    };
  } catch {
    // Bedrock unavailable (e.g. model access not yet enabled) — fall back to
    // a transparent keyword pass so the flow still works end to end.
    return heuristicParse(resumeText);
  }
}

function heuristicParse(resumeText: string): ParseOutcome {
  const text = resumeText.toLowerCase();
  const probes: { key: string; label: string; words: string[] }[] = [
    { key: 'macos', label: 'macOS · endpoint management', words: ['jamf', 'macos', 'apple', 'mdm'] },
    { key: 'intune', label: 'Intune · cross-platform MDM', words: ['intune', 'windows', 'euc'] },
    { key: 'identity', label: 'Identity · SSO', words: ['okta', 'sso', 'scim', 'identity'] },
    { key: 'security', label: 'Endpoint security', words: ['security', 'edr', 'baseline', 'filevault', 'cis'] },
    { key: 'build', label: 'Software build', words: ['react', 'typescript', 'aws', 'amplify', 'python'] },
    { key: 'client', label: 'Client-facing', words: ['speaker', 'consult', 'client', 'pre-sales'] },
  ];
  const strengths: Strength[] = [];
  const sugTerms: SuggestedTerm[] = [];
  for (const p of probes) {
    const hits = p.words.filter((w) => text.includes(w));
    if (!hits.length) continue;
    strengths.push({
      key: p.key,
      label: p.label,
      conf: 'MED',
      weight: hits.length >= 3 ? 3 : 2,
      bar: Math.min(95, 40 + hits.length * 15),
      ev: `Keyword evidence: ${hits.join(', ')} (heuristic parse — AI parse unavailable).`,
    });
    sugTerms.push(...hits.map((label) => ({ label, added: false })));
  }
  const canada = /canada|canadian/.test(text);
  return {
    strengths,
    sugTerms: sugTerms.slice(0, 8),
    sugCos: [],
    facts: canada ? { canadaEligible: true } : null,
  };
}

// ---------------------------------------------------------------------------
// The sweep: invoke the Lambda, persist results owner-side, refine top fits

export interface SweepOutcome {
  roles: Role[];
  gems: Gem[];
  proposals: Proposal[];
  proposalState: Record<string, 'approved' | 'dismissed'>;
  summary: SweepSummary;
  runSummary: string;
  perSource: { id: string; count: number }[];
}

export async function runSweepRemote(
  cfg: SearchConfigState,
  resumeText: string,
): Promise<SweepOutcome> {
  const c = client();
  const activeIds = cfg.sources
    .filter((s) => s.on && SOURCE_ADAPTER_IDS[s.name])
    .map((s) => SOURCE_ADAPTER_IDS[s.name]);
  const terms = cfg.termGroups.flatMap((g) => g.terms);
  const watchlist = cfg.watchlist
    .filter((w) => !cfg.watchPaused[w.name] && !cfg.excluded.includes(w.name))
    .map((w) => ({
      company: w.name,
      provider: w.src.toLowerCase(),
      slug: w.slug ?? w.name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    }));

  const res = await c.mutations.startSweep({
    config: JSON.stringify({
      terms,
      watchlist,
      excludedCompanies: cfg.excluded,
      activeSources: activeIds,
    }),
  });
  if (res.errors?.length) throw new Error(res.errors[0].message);
  const result = parseJsonField<SweepResultWire | null>(res.data, null);
  if (!result) throw new Error('Sweep returned no data');

  // Upsert into owner-scoped Role rows, keyed by stable sourceId.
  const existing = await listAllRoles();
  const bySourceId = new Map(existing.map((r) => [r.sourceId, r]));
  const now = new Date().toISOString();

  for (const wire of result.roles) {
    const prev = bySourceId.get(wire.sourceId);
    if (prev) {
      const prevFit = parseJsonField<FitJson | null>(prev.fit, null);
      const keepAi = prevFit?.source === 'ai';
      await c.models.Role.update({
        id: prev.id,
        seenCount: (prev.seenCount ?? 1) + 1,
        lastSeen: now,
        seenRuns: [...(prev.seenRuns ?? []).map((r) => !!r).slice(-7), true],
        fit: JSON.stringify(keepAi ? prevFit : baselineFit(wire, cfg)),
        gem: wire.gem ? JSON.stringify(wire.gem) : prev.gem == null ? undefined : prev.gem,
      });
    } else {
      const created = await c.models.Role.create({
        sourceId: wire.sourceId,
        title: wire.title,
        company: wire.company,
        location: wire.location,
        url: wire.url || undefined,
        rawDescription: wire.rawDescription,
        sourceName: wire.sourceName,
        eligibility: JSON.stringify(wire.eligibility),
        eligibilityOverridden: false,
        fit: JSON.stringify(baselineFit(wire, cfg)),
        seenCount: 1,
        firstSeen: now,
        lastSeen: now,
        seenRuns: [true],
        phantomMuted: false,
        gem: wire.gem ? JSON.stringify(wire.gem) : undefined,
        gemDecision: wire.gem ? 'pending' : undefined,
        pipelineStage: 'none',
        dismissed: false,
      });
      if (created.data) bySourceId.set(wire.sourceId, created.data as unknown as RoleRow);
    }
  }

  // AI fit refinement for the strongest new reads — best effort; a Bedrock
  // hiccup leaves the honest baseline in place.
  if (resumeText.trim()) {
    const refreshed = await listAllRoles();
    const candidates = refreshed
      .filter((r) => parseJsonField<FitJson | null>(r.fit, null)?.source !== 'ai' && r.rawDescription)
      .sort(
        (a, b) =>
          (parseJsonField<FitJson | null>(b.fit, null)?.score ?? 0) -
          (parseJsonField<FitJson | null>(a.fit, null)?.score ?? 0),
      )
      .slice(0, 6);
    await Promise.allSettled(
      candidates.map(async (row) => {
        const gen = await c.generations.generateFit({
          roleDescription: row.rawDescription ?? '',
          roleTitle: row.title,
          roleLocation: row.location ?? undefined,
          profile: resumeText,
        });
        if (!gen.data) return;
        const dims = parseJsonField<Record<string, string>>(gen.data.dims, {});
        const baseline = parseJsonField<FitJson | null>(row.fit, null);
        const fit: FitJson = {
          score: gen.data.score ?? baseline?.score ?? 0,
          verdict: (gen.data.verdict as unknown as VerdictKey) ?? baseline?.verdict ?? 'reach',
          sentence: gen.data.sentence,
          dims: { ...EMPTY_DIMS, ...(dims as Record<DimKey, DimState>) },
          notes: {},
          chips: (gen.data.chips ?? [])
            .filter((x): x is string => !!x)
            .slice(0, 4)
            .map((text) => [text, chipToneFor(text)] as [string, ChipTone]),
          source: 'ai',
        };
        await c.models.Role.update({ id: row.id, fit: JSON.stringify(fit) });
      }),
    );
  }

  // Phantom proposals: Radar proposes, the owner approves (the only path by
  // which a phantom gets muted).
  const finalRows = await listAllRoles();
  const phantoms = finalRows.filter((r) => {
    const seen = r.seenCount ?? 1;
    return seen >= 4 && daysBetween(r.firstSeen, new Date()) >= 30 && !r.phantomMuted;
  });
  const existingProposals = await c.models.Proposal.list({ limit: 200 });
  const proposedRoleIds = new Set(
    (existingProposals.data ?? [])
      .filter((p) => p.kind === 'mutePhantom')
      .map((p) => parseJsonField<{ roleId?: string }>(p.payload, {}).roleId),
  );
  for (const row of phantoms) {
    if (proposedRoleIds.has(row.id)) continue;
    await c.models.Proposal.create({
      kind: 'mutePhantom',
      title: `Mute phantom: ${row.title} @ ${row.company}`,
      rationale: `Seen ${row.seenCount}× over ${daysBetween(row.firstSeen, new Date())} days and never observed to fill. Muting stops it resurfacing until the posting changes.`,
      payload: JSON.stringify({ roleId: row.id }),
      status: 'pending',
      resolvedNote: 'Muted until the posting changes.',
    });
  }

  const phantomCount = phantoms.length;
  await c.models.SweepRun.create({
    status: 'done',
    progress: JSON.stringify(result.perSource),
    fetched: result.fetched,
    kept: result.kept,
    phantoms: phantomCount,
    gems: result.gems,
    summary: result.summary,
  });

  // Re-hydrate the slices a sweep touches.
  const snapshot = await loadAccount();
  return {
    roles: snapshot.roles,
    gems: snapshot.gems,
    proposals: snapshot.proposals,
    proposalState: snapshot.proposalState,
    summary: { ...snapshot.summary, when: 'just now' },
    runSummary:
      result.summary +
      (phantomCount ? ` ${phantomCount} phantom${phantomCount > 1 ? 's' : ''} flagged.` : ''),
    perSource: result.perSource,
  };
}

function chipToneFor(text: string): ChipTone {
  if (/^[−-]/.test(text)) return 'warn';
  if (/^[✕⚠×]/.test(text)) return 'bad';
  return 'good';
}

/** Deterministic keyword fit — honest about being a baseline. The dims light
 *  up from which term groups matched; the AI read replaces this when it runs. */
function baselineFit(wire: ScoredRoleWire, cfg: SearchConfigState): FitJson {
  const dims: Record<DimKey, DimState> = { ...EMPTY_DIMS };
  const matched = new Set(wire.matchedTerms.map((t) => t.toLowerCase()));
  cfg.termGroups.forEach((group, gi) => {
    const hit = group.terms.some((t) => matched.has(t.toLowerCase()));
    if (!hit) return;
    for (const dim of GROUP_DIMS[gi] ?? []) dims[dim] = wire.titleHit ? 'hit' : 'partial';
  });
  const body = wire.rawDescription.toLowerCase();
  if (/react|typescript|aws|amplify|terraform|python/.test(body)) dims.build = 'partial';
  const title = wire.title.toLowerCase();
  const junior = /support specialist|help ?desk|junior|tier ?[12]|technician/.test(title);
  const senior = /senior|staff|lead|principal/.test(title);
  dims.level = junior ? 'thin' : senior ? 'hit' : 'partial';
  dims.eligible = wire.eligibility.state === 'ca' ? 'hit' : wire.eligibility.state === 'us' ? 'us' : 'partial';

  const verdict: VerdictKey = junior ? 'below' : wire.score >= 75 ? 'match' : 'reach';
  const chips: [string, ChipTone][] = wire.matchedTerms
    .slice(0, 3)
    .map((t) => [`+ ${t}`, 'good'] as [string, ChipTone]);
  if (wire.eligibility.state === 'us') chips.push(['✕ US-authorization only', 'bad']);
  if (junior) chips.push(['− Reads below level', 'warn']);

  return {
    score: wire.score,
    verdict,
    sentence:
      `Keyword read: matched ${wire.matchedTerms.length} of your terms` +
      `${wire.titleHit ? ' (including the title)' : ' on description content only'}. ` +
      'This is the baseline scorer — the AI fit read replaces it for top matches after each sweep.',
    dims,
    notes: {},
    chips,
    source: 'baseline',
  };
}

// ---------------------------------------------------------------------------
// Radar conversation (AI Kit conversation route, streaming)

type ConversationHandle = {
  sendMessage: (input: string) => Promise<unknown>;
  onStreamEvent: (handlers: {
    next: (event: { text?: string; stopReason?: string }) => void;
    error: (error: unknown) => void;
  }) => { unsubscribe: () => void };
};

let conversation: ConversationHandle | null = null;

export async function sendChatRemote(
  text: string,
  onDelta: (delta: string) => void,
  onDone: () => void,
): Promise<void> {
  const c = client();
  if (!conversation) {
    const { data } = await c.conversations.chat.create();
    if (!data) throw new Error('Could not start a Radar conversation');
    conversation = data as unknown as ConversationHandle;
    conversation.onStreamEvent({
      next: (event) => {
        if (event.text) onDelta(event.text);
        if (event.stopReason) onDone();
      },
      error: () => onDone(),
    });
  }
  await conversation.sendMessage(text);
}
