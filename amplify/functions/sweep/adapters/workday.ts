// Workday — watchlist-driven ATS adapter (per-tenant, ARCHITECTURE.md §2).
// The watchlist slug carries `{tenant}:{dc}:{site}` (captured from a pasted
// myworkdayjobs.com careers URL); the public CXS endpoint needs no auth.

import {
  eligibilityFromLocation,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

interface WorkdayPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

export const workday: SourceAdapter = {
  id: 'workday',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'workday');
    const postings: RawPosting[] = [];
    for (const entry of entries) {
      const [tenant, dc, site] = entry.slug.split(':');
      if (!tenant || !dc || !site) {
        console.log(`workday entry skipped (needs tenant:dc:site slug): ${entry.company}`);
        continue;
      }
      try {
        const base = `https://${tenant}.${dc}.myworkdayjobs.com`;
        const res = await fetch(`${base}/wday/cxs/${tenant}/${site}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: '' }),
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) {
          console.log(`workday board ${entry.slug}: HTTP ${res.status}`);
          continue;
        }
        const body = (await res.json()) as { jobPostings?: WorkdayPosting[] };
        for (const job of body.jobPostings ?? []) {
          if (!job.title || !job.externalPath) continue;
          postings.push({
            sourceId: `workday:${entry.slug}:${job.externalPath}`,
            title: job.title,
            company: entry.company,
            location: job.locationsText ?? '',
            url: `${base}/en-US/${site}${job.externalPath}`,
            // The CXS list omits descriptions (a per-job call each — too many
            // for the sweep window); title + location still rank and dedup.
            description: [job.title, job.locationsText, ...(job.bulletFields ?? [])]
              .filter(Boolean)
              .join(' · '),
            postedAt: job.postedOn,
          });
        }
      } catch {
        // Network hiccup on one board never sinks the whole sweep.
      }
    }
    return postings;
  },

  normalize(raw: RawPosting): NormalizedRole {
    return {
      sourceId: raw.sourceId,
      title: raw.title,
      company: raw.company,
      location: raw.location,
      url: raw.url,
      rawDescription: raw.description,
      sourceName: 'Workday',
      eligibility: eligibilityFromLocation(raw.location, 'Workday location'),
    };
  },
};
