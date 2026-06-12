// Workable — watchlist-driven ATS adapter. Public, no-auth widget endpoint
// keyed by company slug (the pattern behind apply.workable.com/{slug});
// one shared adapter serves every user.

import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const BOARD_URL = (slug: string) =>
  `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}?details=true`;

interface WorkableJob {
  title: string;
  shortcode: string;
  url?: string;
  application_url?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: { city?: string; region?: string; country?: string };
  description?: string;
  created_at?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jobLocation(job: WorkableJob): string {
  const parts = job.location
    ? [job.location.city, job.location.region, job.location.country]
    : [job.city, job.state, job.country];
  return parts.filter(Boolean).join(', ');
}

export const workable: SourceAdapter = {
  id: 'workable',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'workable');
    const postings: RawPosting[] = [];
    for (const entry of entries) {
      try {
        const res = await fetch(BOARD_URL(entry.slug), { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue; // board gone or renamed — skip, don't fail the sweep
        const body = (await res.json()) as { jobs?: WorkableJob[] };
        for (const job of body.jobs ?? []) {
          const description = stripHtml(job.description ?? '');
          postings.push({
            sourceId: `workable:${entry.slug}:${job.shortcode}`,
            title: job.title,
            company: entry.company,
            location: jobLocation(job),
            url: job.url ?? job.application_url ?? `https://apply.workable.com/j/${job.shortcode}`,
            description,
            postedAt: job.created_at,
            salary: extractSalary(description),
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
      sourceName: 'Workable',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location, 'Workable location'),
    };
  },
};
