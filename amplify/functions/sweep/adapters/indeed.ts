// Indeed — aggregate feed adapter via the job-seeker RSS pattern
// (https://ca.indeed.com/rss?q=…). Best effort, eyes open: Indeed has
// retired public RSS in some regions and rate-limits datacenter traffic, so
// this adapter is built to fail quietly — a blocked feed logs one diagnostic
// line and contributes zero roles rather than sinking the sweep. If feeds
// stay blocked from Lambda, turn the source off in Range; Indeed remains
// reachable through the manual paste-in lane (ARCHITECTURE.md §2).

import { firstField, parseItems, splitFeedTitle } from './rss';
import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

// Canadian portal; national scope (empty l= covers all of Canada).
const FEED_URL = (term: string) => `https://ca.indeed.com/rss?q=${encodeURIComponent(term)}&l=`;

// A plain browser UA — Indeed serves RSS to readers/browsers; the default
// undici UA is rejected outright.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/605.1.15',
  Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
};

/** Indeed links carry the stable job key as ?jk= — the dedup id. */
function jobKey(link: string): string {
  const m = link.match(/[?&]jk=([a-z0-9]+)/i);
  return m ? `indeed:${m[1]}` : `indeed:${link}`;
}

export const indeed: SourceAdapter = {
  id: 'indeed',
  kind: 'rss',
  scope: 'aggregate',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const postings: RawPosting[] = [];
    const seen = new Set<string>();
    let logged = false;
    for (const term of config.terms) {
      try {
        const res = await fetch(FEED_URL(term), {
          headers: HEADERS,
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) {
          if (!logged) {
            console.log(`indeed feed blocked: HTTP ${res.status} for term "${term}"`);
            logged = true;
          }
          continue;
        }
        const xml = await res.text();
        if (!logged) {
          const sample = xml.match(/<item[\s>][\s\S]{0,600}/)?.[0];
          console.log('indeed sample item:', sample ?? `(no items; first 200 chars: ${xml.slice(0, 200)})`);
          logged = true;
        }
        for (const fields of parseItems(xml)) {
          const link = firstField(fields, ['link', 'guid']);
          if (!link) continue;
          const id = jobKey(link);
          if (seen.has(id)) continue;
          seen.add(id);

          const rawTitle = firstField(fields, ['title']);
          const fromTitle = splitFeedTitle(rawTitle);
          const company = firstField(fields, ['source', 'dc:creator', 'author']) || fromTitle.company;
          const location = firstField(fields, ['georss:point', 'location']) || fromTitle.location;
          const description = firstField(fields, ['description', 'content:encoded', 'summary']);

          postings.push({
            sourceId: id,
            title: company ? rawTitle : fromTitle.title,
            company,
            location,
            url: link,
            description,
            salary: extractSalary(description),
          });
        }
      } catch {
        // One bad term/feed never sinks the sweep.
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
      sourceName: 'Indeed RSS',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location || 'Canada', 'Indeed RSS location'),
    };
  },
};
