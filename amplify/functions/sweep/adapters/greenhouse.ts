// Greenhouse — watchlist-driven ATS adapter. Public, no-auth board endpoint
// keyed by company slug; one shared adapter serves every user, fanned out
// across the owner's watchlist. Be a good citizen: server-side only, modest
// fan-out, polite backoff.

import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const BOARD_URL = (slug: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
}

/** Strip the HTML Greenhouse returns in `content` down to scoreable text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const greenhouse: SourceAdapter = {
  id: 'greenhouse',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'greenhouse');
    const postings: RawPosting[] = [];
    for (const entry of entries) {
      try {
        const res = await fetch(BOARD_URL(entry.slug));
        if (!res.ok) continue; // board gone or renamed — skip, don't fail the sweep
        const body = (await res.json()) as { jobs?: GreenhouseJob[] };
        for (const job of body.jobs ?? []) {
          const description = stripHtml(job.content ?? '');
          postings.push({
            sourceId: `greenhouse:${entry.slug}:${job.id}`,
            title: job.title,
            company: entry.company,
            location: job.location?.name ?? '',
            url: job.absolute_url,
            description,
            postedAt: job.updated_at,
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
      sourceName: 'Greenhouse',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location, 'Greenhouse location field'),
    };
  },
};
