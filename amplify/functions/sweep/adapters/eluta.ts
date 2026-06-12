// Eluta.ca — aggregate feed adapter (sanctioned RSS/OpenSearch, Canadian).
// A single public feed queried with the owner's weighted terms; no
// per-company config, just on/off. This is the firehose that surfaces roles
// outside the watchlist — with real Canadian locations, so eligibility is
// nearly free.

import { firstField, looksLikeLocation, parseItems, splitFeedTitle } from './rss';
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
    const postings: RawPosting[] = [];
    const seen = new Set<string>();
    let logged = false;
    for (const term of config.terms) {
      try {
        const res = await fetch(FEED_URL(term));
        if (!res.ok) continue;
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
          if (!link || seen.has(link)) continue;
          seen.add(link);

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

          postings.push({
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
      sourceName: 'Eluta RSS',
      salary: raw.salary,
      eligibility: eligibilityFromLocation(raw.location || 'Canada', 'Eluta RSS location'),
    };
  },
};
