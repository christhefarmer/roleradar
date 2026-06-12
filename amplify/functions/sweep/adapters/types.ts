// The pluggable source-adapter contract (ARCHITECTURE.md §2): one common
// Role shape that every source normalizes into. A source is an adapter the
// backend knows how to fetch and map — the browser never touches feeds.

export type AdapterId =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
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
  /** Posting-stated compensation, when the source exposes or mentions it. */
  salary?: string;
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
  salary?: string;
  eligibility: {
    state: 'ca' | 'us' | 'other' | 'remote' | 'unknown';
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

/** Best-effort salary extraction from posting text: annual figures/ranges
 *  ($95,000 – $120,000 / $110k) and hourly rates ($45/hour). Guarded against
 *  small-dollar noise; a heuristic hint like everything else. */
export function extractSalary(text: string): string | undefined {
  const annual =
    /\$\s?(\d{1,3}(?:[, ]\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])(?:\s?(?:[-–—]|to)\s?\$?\s?(\d{1,3}(?:[, ]\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK]))?/;
  const hourly = /\$\s?\d{2,3}(?:\.\d{2})?\s?(?:\/|per\s|an\s)\s?(?:hour|hr)\b/i;
  const toNum = (s: string) =>
    /k/i.test(s) ? parseFloat(s) * 1000 : parseInt(s.replace(/[ ,]/g, ''), 10);
  const m = text.match(annual);
  if (m && toNum(m[1]) >= 30_000) return m[0].replace(/\s+/g, ' ').trim();
  const h = text.match(hourly);
  if (h) return h[0].replace(/\s+/g, ' ').trim();
  return undefined;
}

// Geo signals for the eligibility hint. Country/region words and large hiring
// hubs — coarse on purpose; anything unmatched stays an honest "unknown".
const CA_RE =
  /canada|canadian|\b(ontario|qu[ée]bec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut)\b|\b(toronto|vancouver|montr[ée]al|winnipeg|calgary|edmonton|ottawa|halifax|victoria|mississauga|waterloo|kitchener|burnaby|regina|saskatoon|gatineau|laval|hamilton|london,? on)\b|,\s*(on|bc|ab|mb|qc|sk|ns|nb|nl|pe|yt|nt|nu)\b/i;

const US_RE =
  /united states|\busa?\b(?!\w)|u\.s\.|us[- ]only|us remote|\b(new york|san francisco|seattle|austin|boston|chicago|denver|atlanta|los angeles|dallas|houston|miami|portland|phoenix|philadelphia|washington,? dc)\b|,\s*(ny|wa|tx|ma|co|il|ga|fl|pa|az|nc|va|or|ut|md|mn|mi|oh|nj|tn|wi|mo|in|sc|ky|al|la|ok|ks|nv|ia|ar|ms|ct|dc)\b/i;

const OTHER_RE =
  /\b(uk|united kingdom|england|scotland|wales|ireland|india|poland|germany|france|netherlands|spain|portugal|italy|romania|czech|hungary|ukraine|austria|belgium|sweden|norway|denmark|finland|switzerland|australia|new zealand|singapore|japan|china|hong kong|taiwan|korea|brazil|mexico|argentina|colombia|chile|philippines|indonesia|vietnam|thailand|malaysia|pakistan|bangladesh|sri lanka|nigeria|kenya|south africa|egypt|israel|uae|dubai|saudi|turkey|emea|apac|latam|europe|european)\b|\b(london|dublin|warsaw|krak[óo]w|berlin|munich|amsterdam|paris|madrid|barcelona|lisbon|milan|rome|bangalore|bengaluru|hyderabad|mumbai|delhi|pune|chennai|noida|gurgaon|gurugram|tokyo|sydney|melbourne|tel aviv|zurich|stockholm|copenhagen|oslo|helsinki|prague|budapest|bucharest|vienna|brussels|manchester|edinburgh|belfast|cork)\b/i;

const REMOTE_RE = /\bremote\b|work from home|anywhere|worldwide|\bglobal\b|distributed/i;

/** Eligibility is a heuristic hint read from the location text — flagged,
 *  never assumed. Always returned with provenance for the override UI.
 *  Order matters: an explicit region beats a bare "remote". */
export function eligibilityFromLocation(
  location: string,
  provenance: string,
): NormalizedRole['eligibility'] {
  const loc = location.toLowerCase();
  if (CA_RE.test(loc)) {
    return { state: 'ca', label: 'CA ✓', detail: `${provenance} reads “${location}”. Canada-eligible.` };
  }
  if (OTHER_RE.test(loc)) {
    return {
      state: 'other',
      label: 'NOT CA',
      detail: `${provenance} reads “${location}” — outside Canada. Hidden by the Canada filter; override only if the posting allows Canadian remote.`,
    };
  }
  if (US_RE.test(loc)) {
    return {
      state: 'us',
      label: 'US ONLY',
      detail: `${provenance} reads “${location}”. Requires US authorization — override only if you hold it.`,
    };
  }
  if (REMOTE_RE.test(loc)) {
    return {
      state: 'remote',
      label: 'REMOTE ✻',
      detail: `${provenance} reads “${location}” — remote with no stated region. Verify Canada eligibility on the posting.`,
    };
  }
  return {
    state: 'unknown',
    label: 'CHECK ✻',
    detail: `${provenance} reads “${location}”. Eligibility unclear — confirm on the posting.`,
  };
}
