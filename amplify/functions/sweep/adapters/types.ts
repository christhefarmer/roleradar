// The pluggable source-adapter contract (ARCHITECTURE.md §2): one common
// Role shape that every source normalizes into. A source is an adapter the
// backend knows how to fetch and map — the browser never touches feeds.

export type AdapterId =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'eluta'
  | 'wwr'
  | 'remotive'
  | 'jobbank'
  | 'adzuna'
  | 'hn'
  | 'linkedin-manual';

export type AdapterKind = 'ats-json' | 'rss' | 'manual';

/** watchlist = fanned out per company slug; aggregate = single global feed. */
export type AdapterScope = 'watchlist' | 'aggregate' | 'manual';

/** A watchlist entry — per-user "configuration" is this, never credentials. */
export interface WatchlistEntry {
  company: string;
  provider: string;
  slug: string;
  /** Workday only */
  tenant?: string;
  dc?: string;
  site?: string;
}

export interface FetchConfig {
  watchlist: WatchlistEntry[];
  /** Aggregate-feed query terms (weighted search terms, flattened). */
  terms: string[];
  region?: string;
}

export interface RawPosting {
  sourceId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  postedAt?: string;
}

/** The common normalized shape — pre-scoring. */
export interface NormalizedRole {
  sourceId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  rawDescription: string;
  sourceName: string;
  eligibility: {
    state: 'ca' | 'us' | 'unknown';
    label: string;
    /** Provenance — e.g. `Greenhouse location field: "Canada (Remote)"`. */
    detail: string;
  };
}

export interface SourceAdapter {
  id: AdapterId;
  kind: AdapterKind;
  scope: AdapterScope;
  fetch(config: FetchConfig): Promise<RawPosting[]>;
  normalize(raw: RawPosting): NormalizedRole;
}

/** Eligibility is a heuristic hint read from the location text — flagged,
 *  never assumed. Always returned with provenance for the override UI. */
export function eligibilityFromLocation(
  location: string,
  provenance: string,
): NormalizedRole['eligibility'] {
  const loc = location.toLowerCase();
  if (/canada|\bca\b|toronto|vancouver|montr[ée]al|winnipeg|calgary|ottawa|remote.*canada/.test(loc)) {
    return { state: 'ca', label: 'CA ✓', detail: `${provenance} reads “${location}”. Canada-eligible.` };
  }
  if (/united states|\bus\b|usa|us only|us-only|us remote/.test(loc)) {
    return {
      state: 'us',
      label: 'US ONLY',
      detail: `${provenance} reads “${location}”. Requires US authorization — override only if you hold it.`,
    };
  }
  return {
    state: 'unknown',
    label: 'CHECK ✻',
    detail: `${provenance} reads “${location}”. Eligibility unclear — confirm on the posting.`,
  };
}
