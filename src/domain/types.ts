// Domain model — mirrors the common `Role` shape every source adapter
// normalizes into (ARCHITECTURE.md §2) and the per-account state the
// Amplify Data models persist. The UI consumes these types whether the
// data comes from the seed (design fidelity) or AppSync.

export type ViewKey = 'radar' | 'gems' | 'recommend' | 'search' | 'pipeline' | 'profile';

export type DimKey =
  | 'macos'
  | 'intune'
  | 'identity'
  | 'security'
  | 'build'
  | 'client'
  | 'level'
  | 'eligible';

/** Per-dimension fit read: hit / partial / thin / not-applicable / US-blocked. */
export type DimState = 'hit' | 'partial' | 'thin' | 'na' | 'us';

export type VerdictKey = 'match' | 'reach' | 'below' | 'mismatch';

export type EligState = 'ca' | 'us';

/** Eligibility is a heuristic hint — always carried with provenance. */
export interface Eligibility {
  state: EligState;
  label: string;
  detail?: string;
}

export type ChipTone = 'good' | 'warn' | 'bad';

export interface PhantomSignal {
  seen: number;
  days: number;
  /** Presence across the last N sweeps — the seen-count timeline dots. */
  runs: boolean[];
}

export interface Role {
  id: string;
  /** Amplify Data record id (connected mode only). */
  recordId?: string;
  /** Original posting URL (connected mode). */
  url?: string;
  title: string;
  company: string;
  location: string;
  posted: string;
  days: number;
  source: string;
  score: number;
  verdict: VerdictKey;
  dims: Record<DimKey, DimState>;
  /** Plain-language note per dimension; falls back to a generic note. */
  notes: Partial<Record<DimKey, string>>;
  chips: [text: string, tone: ChipTone][];
  /** The honest verdict sentence — never a black-box number. */
  sentence: string;
  elig: Eligibility;
  phantom?: PhantomSignal;
  /** Down-ranked (below level / domain mismatch) regardless of score. */
  down?: boolean;
}

export type GemSubtype = 'CONTENT MATCH' | 'COMPANY SIGNAL';

export interface Gem {
  id: string;
  /** Amplify Data record id (connected mode only). */
  recordId?: string;
  title: string;
  company: string;
  location: string;
  source: string;
  subtype: GemSubtype;
  fit: number;
  whyLabel: string;
  whyText: string;
  matches: string[];
  elig: Eligibility;
}

export type PipelineStageKey =
  | 'new'
  | 'interested'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'closed';

export type ProposalTone = 'good' | 'warn' | 'bad';

/** A Radar proposal — the bot may propose; only an explicit Approve acts. */
export interface Proposal {
  id: string;
  /** Amplify Data record id (connected mode only). */
  recordId?: string;
  kind: string;
  tone: ProposalTone;
  title: string;
  rationale: string;
  /** Confirmation copy shown once approved. */
  ok: string;
  /** Machine-readable payload the approval executes (e.g. { roleId }). */
  payload?: Record<string, string>;
}

export interface TermGroup {
  name: string;
  weight: number;
  terms: string[];
}

export interface WatchEntry {
  name: string;
  /** ATS provider tag (Greenhouse / Lever / Ashby / Workday / RSS). */
  src: string;
  /** Resolved board slug for the ATS adapters (captured at add-time from a
   *  careers URL — ARCHITECTURE.md §2; defaults to a normalized name). */
  slug?: string;
}

export interface SourceDef {
  name: string;
  note: string;
  tag: 'ACTIVE' | 'OFF' | 'MANUAL';
  on: boolean;
}

export type RunStatus = 'pending' | 'scanning' | 'done' | 'manual';

export interface RunSource {
  name: string;
  detail: string;
  count: string;
  kind: 'auto' | 'manual';
  status: RunStatus;
}

export interface SweepSummary {
  fetched: number;
  kept: number;
  phantoms: number;
  gems: number;
  when: string;
}

export type StrengthConfidence = 'HIGH' | 'MED' | 'RARE';

export interface Strength {
  key: string;
  label: string;
  conf: StrengthConfidence;
  weight: number;
  bar: number;
  /** Evidence quote lifted from the résumé. */
  ev: string;
}

export interface SuggestedTerm {
  label: string;
  added: boolean;
}

export interface SuggestedCompany {
  name: string;
  reason: string;
}

export interface DiscoveryTrace {
  from: string;
  count: number;
  hyp: string;
  finds: string[];
}

export type ChatRole = 'bot' | 'user' | 'match' | 'proposals';

export interface ChatMessage {
  role: ChatRole;
  text?: string;
  /** Desktop rail: the proposal queue rides along with this bot message. */
  showProposals?: boolean;
}

export type Autonomy = 'conservative' | 'balanced' | 'wide';

export type AuthMode = 'signin' | 'signup' | 'confirm' | 'forgot';
