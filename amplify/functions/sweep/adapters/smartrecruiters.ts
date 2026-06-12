// SmartRecruiters — watchlist-driven ATS adapter. Public, no-auth Posting
// API keyed by company identifier; descriptions come from a capped number of
// per-posting detail calls so the sweep stays inside its window.

import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const LIST_URL = (slug: string) =>
  `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=50`;
const DETAIL_URL = (slug: string, id: string) =>
  `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${encodeURIComponent(id)}`;
const DETAIL_CAP = 10;

interface SrPosting {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean };
}

interface SrDetail {
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function srLocation(loc?: SrPosting['location']): string {
  const parts = [loc?.city, loc?.region, loc?.country?.toUpperCase()].filter(Boolean);
  if (loc?.remote) parts.push('Remote');
  return parts.join(', ');
}

export const smartrecruiters: SourceAdapter = {
  id: 'smartrecruiters',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'smartrecruiters');
    const postings: RawPosting[] = [];
    for (const entry of entries) {
      try {
        const res = await fetch(LIST_URL(entry.slug), { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue; // board gone or renamed — skip, don't fail the sweep
        const body = (await res.json()) as { content?: SrPosting[] };
        const jobs = body.content ?? [];
        const details = await Promise.allSettled(
          jobs.slice(0, DETAIL_CAP).map(async (job) => {
            const d = await fetch(DETAIL_URL(entry.slug, job.id), {
              signal: AbortSignal.timeout(5000),
            });
            if (!d.ok) return '';
            const detail = (await d.json()) as SrDetail;
            return Object.values(detail.jobAd?.sections ?? {})
              .map((s) => stripHtml(s?.text ?? ''))
              .join(' ');
          }),
        );
        jobs.forEach((job, i) => {
          const detail = details[i]?.status === 'fulfilled' ? (details[i] as PromiseFulfilledResult<string>).value : '';
          const description = detail || job.name;
          postings.push({
            sourceId: `smartrecruiters:${entry.slug}:${job.id}`,
            title: job.name,
            company: entry.company,
            location: srLocation(job.location),
            url: `https://jobs.smartrecruiters.com/${entry.slug}/${job.id}`,
            description,
            postedAt: job.releasedDate,
            salary: extractSalary(description),
          });
        });
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
      sourceName: 'SmartRecruiters',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location, 'SmartRecruiters location'),
    };
  },
};
