// Job Bank (jobbank.gc.ca) — aggregate feed adapter via the Government of
// Canada's sanctioned job-search RSS. Term-driven like Eluta; every posting
// is Canadian by definition, so eligibility is effectively free. No public
// JSON/search API exists (the open-data sets are bulk dumps, not a query
// endpoint), so the RSS feed is the integration.

import { mapLimit } from './concurrency';
import {
  FEED_CONCURRENCY,
  fetchFeed,
  firstField,
  looksLikeLocation,
  parseItems,
  splitFeedTitle,
} from './rss';
import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

// Same query params as the search page; sort=M = most recent first. rows pulls
// a full page per term (the default page is small) — deduped across terms after.
const FEED_URL = (term: string) =>
  `https://www.jobbank.gc.ca/jobsearch/feed/jobSearchRSSfeed?searchstring=${encodeURIComponent(
    term,
  )}&sort=M&rows=100`;

/** Job Bank posting ids live in the link as /jobposting/{id}. */
function jobKey(link: string): string {
  const m = link.match(/jobposting\/(\d+)/i);
  return m ? `jobbank:${m[1]}` : `jobbank:${link}`;
}

export const jobbank: SourceAdapter = {
  id: 'jobbank',
  kind: 'rss',
  scope: 'aggregate',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    let logged = false;
    const batches = await mapLimit(config.terms, FEED_CONCURRENCY, async (term) => {
      const out: RawPosting[] = [];
      try {
        const res = await fetchFeed(FEED_URL(term));
        if (!res.ok) {
          if (!logged) {
            console.log(`jobbank feed: HTTP ${res.status} (${res.headers.get('content-type')}) for "${term}"`);
            logged = true;
          }
          return out;
        }
        const xml = await res.text();
        if (!logged) {
          const sample = xml.match(/<item[\s>][\s\S]{0,700}/)?.[0];
          console.log('jobbank sample item:', sample ?? `(no items; first 300: ${xml.slice(0, 300)})`);
          logged = true;
        }
        for (const fields of parseItems(xml)) {
          const link = firstField(fields, ['link', 'guid']);
          if (!link) continue;
          const rawTitle = firstField(fields, ['title']);
          // Job Bank titles read "Job Title - Employer - Location".
          const fromTitle = splitFeedTitle(rawTitle);
          const company =
            firstField(fields, ['dc:creator', 'creator', 'author', 'source']) || fromTitle.company;
          const description = firstField(fields, ['description', 'content:encoded', 'summary']);
          const location =
            firstField(fields, ['location', 'region']) ||
            (fields['category'] ?? []).find(looksLikeLocation) ||
            fromTitle.location;
          out.push({
            sourceId: jobKey(link),
            title: company ? rawTitle : fromTitle.title,
            company,
            location,
            url: link,
            description,
            postedAt: firstField(fields, ['pubdate', 'pubDate', 'dc:date']),
            salary: extractSalary(description),
          });
        }
      } catch {
        // One bad term/feed never sinks the sweep.
      }
      return out;
    });
    // Dedup by link across the parallel term fetches.
    const seen = new Set<string>();
    return batches.flat().filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
  },

  normalize(raw: RawPosting): NormalizedRole {
    return {
      sourceId: raw.sourceId,
      title: raw.title,
      company: raw.company,
      location: raw.location,
      url: raw.url,
      rawDescription: raw.description,
      sourceName: 'Job Bank',
      salary: raw.salary,
      // Government of Canada board — Canadian by definition; the location text
      // refines province when present.
      eligibility: eligibilityFromLocation(raw.location || 'Canada', 'Job Bank location'),
    };
  },
};
