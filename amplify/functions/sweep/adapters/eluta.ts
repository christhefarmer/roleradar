// Eluta.ca — aggregate feed adapter (sanctioned RSS/OpenSearch, Canadian).
// A single public feed queried with the owner's weighted terms; no
// per-company config, just on/off. This is the firehose that surfaces roles
// outside the watchlist — with real Canadian locations, so eligibility is
// nearly free.

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

const FEED_URL = (term: string) => `https://www.eluta.ca/rss?q=${encodeURIComponent(term)}`;

export const eluta: SourceAdapter = {
  id: 'eluta',
  kind: 'rss',
  scope: 'aggregate',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    // Each term is one feed fetch — fan them out (bounded) rather than walk
    // them one slow request at a time. The client caps the term list, so this
    // stays modest; dedup by link happens after collecting across terms.
    let logged = false;
    const batches = await mapLimit(config.terms, FEED_CONCURRENCY, async (term) => {
      const out: RawPosting[] = [];
      try {
        const res = await fetchFeed(FEED_URL(term));
        if (!res.ok) return out;
        const xml = await res.text();
        if (!logged) {
          // One-time diagnostic per sweep: the raw shape of the first item,
          // so field-mapping gaps are visible in CloudWatch.
          const sample = xml.match(/<item[\s>][\s\S]{0,700}/)?.[0];
          if (sample) console.log('eluta sample item:', sample);
          logged = true;
        }
        for (const fields of parseItems(xml)) {
          const link = firstField(fields, ['link', 'guid']);
          if (!link) continue;
          const rawTitle = firstField(fields, ['title']);
          const fromTitle = splitFeedTitle(rawTitle);
          const company =
            firstField(fields, ['dc:creator', 'creator', 'author', 'eluta:employer', 'employer', 'source']) ||
            fromTitle.company;
          const location =
            firstField(fields, ['eluta:location', 'location', 'region']) ||
            (fields['category'] ?? []).find(looksLikeLocation) ||
            fromTitle.location;
          const description = firstField(fields, ['description', 'content:encoded', 'summary']);

          out.push({
            sourceId: `eluta:${link}`,
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
      sourceName: 'Eluta RSS',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location || 'Canada', 'Eluta RSS location'),
    };
  },
};
