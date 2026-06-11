// Lever — watchlist-driven ATS adapter. Public, no-auth postings endpoint
// keyed by company slug; one shared adapter serves every user.

import {
  eligibilityFromLocation,
  extractSalary,
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
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

function formatSalaryRange(r?: LeverPosting['salaryRange']): string | undefined {
  if (!r?.min && !r?.max) return undefined;
  const fmt = (n?: number) => (n ? `$${n.toLocaleString('en-CA')}` : '');
  const range = [fmt(r.min), fmt(r.max)].filter(Boolean).join(' – ');
  const interval = r.interval ? ` per ${r.interval.replace(/-/g, ' ').toLowerCase()}` : '';
  return `${range}${r.currency ? ` ${r.currency}` : ''}${interval}`.trim();
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
          const description = `${job.descriptionPlain ?? ''} ${lists}`.trim();
          postings.push({
            sourceId: `lever:${entry.slug}:${job.id}`,
            title: job.text,
            company: entry.company,
            location: job.categories?.location ?? '',
            url: job.hostedUrl,
            description,
            postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
            salary: formatSalaryRange(job.salaryRange) ?? extractSalary(description),
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
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location, 'Lever location'),
    };
  },
};
