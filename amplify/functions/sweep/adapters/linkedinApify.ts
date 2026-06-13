// LinkedIn via Apify (crawlworks/linkedin-jobs-scraper) — public listings
// only, no LinkedIn account or cookies anywhere near this. Pay-per-result on
// the owner's Apify token (Amplify secret `apify`); without the token the
// adapter skips silently.
//
// Trailing pattern: an actor run takes 30–120s but the sweep must finish in
// <30s, so each sweep (1) collects the dataset of the LAST succeeded run —
// instant — and (2) fire-and-forgets a fresh run with the current terms.
// LinkedIn results therefore lag one sweep behind. The run is capped
// (MAX_ITEMS) to keep per-sweep cost predictable (~$0.005/job).

import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

const ACTOR = 'crawlworks~linkedin-jobs-scraper';
const MAX_ITEMS = 40;

interface ApifyJob {
  // Field names vary across actor versions — read every known alias.
  id?: string | number;
  jobId?: string | number;
  title?: string;
  jobTitle?: string;
  company?: string;
  companyName?: string;
  location?: string;
  jobLocation?: string;
  link?: string;
  url?: string;
  jobUrl?: string;
  description?: string;
  descriptionText?: string;
  salary?: string;
  salaryInfo?: string | string[];
  postedAt?: string;
  postedDate?: string;
}

function jobKey(url: string, fallback: string): string {
  const m = url.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/);
  return m ? `linkedin:${m[1]}` : `linkedin:${fallback}`;
}

export const linkedinApify: SourceAdapter = {
  id: 'linkedin-apify',
  kind: 'rss',
  scope: 'aggregate',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      console.log('linkedin-apify skipped: APIFY_TOKEN not set');
      return [];
    }
    const postings: RawPosting[] = [];
    const seen = new Set<string>();

    // 1. Collect the previous run's results (fast; no run state to store —
    //    Apify keeps the actor's last run addressable directly).
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/runs/last/dataset/items?token=${token}&status=SUCCEEDED&clean=true&limit=${MAX_ITEMS}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const items = (await res.json()) as ApifyJob[];
        for (const job of Array.isArray(items) ? items : []) {
          const title = job.title ?? job.jobTitle ?? '';
          const url = job.link ?? job.url ?? job.jobUrl ?? '';
          if (!title || !url) continue;
          const id = jobKey(url, String(job.id ?? job.jobId ?? url));
          if (seen.has(id)) continue;
          seen.add(id);
          const description = job.description ?? job.descriptionText ?? title;
          const salaryRaw = Array.isArray(job.salaryInfo) ? job.salaryInfo.join(' ') : job.salaryInfo;
          postings.push({
            sourceId: id,
            title,
            company: job.company ?? job.companyName ?? '',
            location: job.location ?? job.jobLocation ?? '',
            url,
            description,
            postedAt: job.postedAt ?? job.postedDate,
            salary: job.salary ?? salaryRaw ?? extractSalary(description),
          });
        }
      } else {
        console.log(`linkedin-apify last-run fetch: HTTP ${res.status}`);
      }
    } catch (e) {
      console.log('linkedin-apify last-run fetch failed', e);
    }

    // 2. Start the next run with the current top terms (fire and forget —
    //    its results arrive on the next sweep). Throttled: skip when a run
    //    started inside the last 30 minutes, so rapid sweeps don't stack
    //    pay-per-result actor runs. Diagnostic-log rejections so an
    //    input-schema mismatch is a one-look fix in CloudWatch.
    try {
      const keywords = config.terms.slice(0, 3).join(' OR ');
      if (keywords) {
        let recentRun = false;
        try {
          const meta = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs/last?token=${token}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (meta.ok) {
            const body = (await meta.json()) as { data?: { startedAt?: string } };
            const startedAt = body.data?.startedAt;
            recentRun = !!startedAt && Date.now() - Date.parse(startedAt) < 30 * 60_000;
          }
        } catch {
          // metadata miss — fall through and start a run
        }
        if (recentRun) {
          console.log('linkedin-apify: last run <30min old — not starting another');
        } else {
          const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keywords,
              keyword: keywords,
              searchKeyword: keywords,
              location: 'Canada',
              maxItems: MAX_ITEMS,
              rows: MAX_ITEMS,
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (!start.ok) {
            console.log(
              `linkedin-apify run start: HTTP ${start.status} — ${(await start.text()).slice(0, 400)}`,
            );
          }
        }
      }
    } catch (e) {
      console.log('linkedin-apify run start failed', e);
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
      sourceName: 'LinkedIn (Apify)',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location || 'Canada', 'LinkedIn location'),
    };
  },
};
