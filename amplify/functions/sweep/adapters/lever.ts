// Lever — watchlist-driven ATS adapter. Public, no-auth postings endpoint
// keyed by company slug; one shared adapter serves every user.

import {
  eligibilityFromLocation,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const POSTINGS_URL = (slug: string) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const lever: SourceAdapter = {
  id: 'lever',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'lever');
    const postings: RawPosting[] = [];
    for (const entry of entries) {
      try {
        const res = await fetch(POSTINGS_URL(entry.slug));
        if (!res.ok) continue; // board gone or renamed — skip, don't fail the sweep
        const body = (await res.json()) as LeverPosting[];
        if (!Array.isArray(body)) continue;
        for (const job of body) {
          const lists = (job.lists ?? [])
            .map((l) => `${l.text} ${stripHtml(l.content)}`)
            .join(' ');
          postings.push({
            sourceId: `lever:${entry.slug}:${job.id}`,
            title: job.text,
            company: entry.company,
            location: job.categories?.location ?? '',
            url: job.hostedUrl,
            description: `${job.descriptionPlain ?? ''} ${lists}`.trim(),
            postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
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
      sourceName: 'Lever',
      eligibility: eligibilityFromLocation(raw.location, 'Lever location'),
    };
  },
};
