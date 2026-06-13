// BambooHR — watchlist-driven ATS adapter via the public careers-site widget
// endpoint ({company}.bamboohr.com/careers/list), the same JSON the hosted
// careers page renders from. Descriptions come from a capped number of
// per-job detail calls.

import { mapLimit } from './concurrency';
import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const LIST_URL = (slug: string) => `https://${slug}.bamboohr.com/careers/list`;
const DETAIL_URL = (slug: string, id: string) => `https://${slug}.bamboohr.com/careers/${id}/detail`;
const DETAIL_CAP = 10;

interface BambooJob {
  id: string | number;
  jobOpeningName?: string;
  departmentLabel?: string;
  employmentStatusLabel?: string;
  isRemote?: boolean | null;
  location?: { city?: string | null; state?: string | null };
  locationType?: string;
}

interface BambooDetail {
  result?: { jobOpening?: { description?: string } };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bambooLocation(job: BambooJob): string {
  const parts = [job.location?.city, job.location?.state].filter(Boolean);
  if (job.isRemote || job.locationType === '1') parts.push('Remote');
  return parts.join(', ');
}

export const bamboohr: SourceAdapter = {
  id: 'bamboohr',
  kind: 'ats-json',
  scope: 'watchlist',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const entries = config.watchlist.filter((w) => w.provider === 'bamboohr');
    const batches = await mapLimit(entries, 4, async (entry) => {
      const out: RawPosting[] = [];
      try {
        const res = await fetch(LIST_URL(entry.slug), {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return out; // tenant gone or careers page disabled — skip
        const body = (await res.json()) as { result?: BambooJob[] };
        const jobs = (body.result ?? []).filter((j) => j.jobOpeningName);
        const details = await Promise.allSettled(
          jobs.slice(0, DETAIL_CAP).map(async (job) => {
            const d = await fetch(DETAIL_URL(entry.slug, String(job.id)), {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
            });
            if (!d.ok) return '';
            const detail = (await d.json()) as BambooDetail;
            return stripHtml(detail.result?.jobOpening?.description ?? '');
          }),
        );
        jobs.forEach((job, i) => {
          const detail = details[i]?.status === 'fulfilled' ? (details[i] as PromiseFulfilledResult<string>).value : '';
          const description =
            detail || [job.jobOpeningName, job.departmentLabel, job.employmentStatusLabel].filter(Boolean).join(' · ');
          out.push({
            sourceId: `bamboohr:${entry.slug}:${job.id}`,
            title: job.jobOpeningName ?? '',
            company: entry.company,
            location: bambooLocation(job),
            url: `https://${entry.slug}.bamboohr.com/careers/${job.id}`,
            description,
            salary: extractSalary(description),
          });
        });
      } catch {
        // Network hiccup on one board never sinks the whole sweep.
      }
      return out;
    });
    return batches.flat();
  },

  normalize(raw: RawPosting): NormalizedRole {
    return {
      sourceId: raw.sourceId,
      title: raw.title,
      company: raw.company,
      location: raw.location,
      url: raw.url,
      rawDescription: raw.description,
      sourceName: 'BambooHR',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location, 'BambooHR location'),
    };
  },
};
