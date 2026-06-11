// Ashby — watchlist-driven ATS adapter. Public, no-auth job-board endpoint
// keyed by company slug; one shared adapter serves every user.

import {
  eligibilityFromLocation,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const BOARD_URL = (slug: string) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  jobUrl?: string;
  applyUrl?: string;
  isListed?: boolean;
  publishedAt?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ashby: SourceAdapter = {
  id: 'ashby',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'ashby');
    const postings: RawPosting[] = [];
    for (const entry of entries) {
      try {
        const res = await fetch(BOARD_URL(entry.slug));
        if (!res.ok) continue; // board gone or renamed — skip, don't fail the sweep
        const body = (await res.json()) as { jobs?: AshbyJob[] };
        for (const job of body.jobs ?? []) {
          if (job.isListed === false) continue;
          const locations = [job.location, ...(job.secondaryLocations ?? []).map((l) => l.location)]
            .filter(Boolean)
            .join(' / ');
          postings.push({
            sourceId: `ashby:${entry.slug}:${job.id}`,
            title: job.title,
            company: entry.company,
            location: locations,
            url: job.jobUrl ?? job.applyUrl ?? '',
            description: job.descriptionPlain ?? stripHtml(job.descriptionHtml ?? ''),
            postedAt: job.publishedAt,
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
      sourceName: 'Ashby',
      eligibility: eligibilityFromLocation(raw.location, 'Ashby location'),
    };
  },
};
