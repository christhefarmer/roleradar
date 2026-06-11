// Eluta.ca — aggregate feed adapter (sanctioned RSS/OpenSearch, Canadian).
// A single public feed queried with the owner's weighted terms; no
// per-company config, just on/off. This is the firehose that surfaces roles
// outside the watchlist — with real Canadian locations, so eligibility is
// nearly free.

import {
  eligibilityFromLocation,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

// Eluta exposes OpenSearch-style RSS per query. Verify the exact parameter
// set against their published OpenSearch description before first production
// sweep; cache responses and respect their rate guidance.
const FEED_URL = (term: string) => `https://www.eluta.ca/rss?q=${encodeURIComponent(term)}`;

/** Minimal RSS <item> extraction — the feed is small and flat, so a
 *  dependency-free parse keeps the Lambda lean. */
function parseRssItems(xml: string): { title: string; link: string; description: string }[] {
  const items: { title: string; link: string; description: string }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const field = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
    return (m?.[1] ?? '').trim();
  };
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    items.push({
      title: field(m[1], 'title'),
      link: field(m[1], 'link'),
      description: field(m[1], 'description'),
    });
  }
  return items;
}

/** Eluta titles arrive as "Job Title - Company - City, Province". */
function splitTitle(raw: string): { title: string; company: string; location: string } {
  const parts = raw.split(' - ').map((s) => s.trim());
  return {
    title: parts[0] ?? raw,
    company: parts[1] ?? '',
    location: parts.slice(2).join(' - '),
  };
}

export const eluta: SourceAdapter = {
  id: 'eluta',
  kind: 'rss',
  scope: 'aggregate',

  async fetch(config: FetchConfig): Promise<RawPosting[]> {
    const postings: RawPosting[] = [];
    const seen = new Set<string>();
    for (const term of config.terms) {
      try {
        const res = await fetch(FEED_URL(term));
        if (!res.ok) continue;
        const xml = await res.text();
        for (const item of parseRssItems(xml)) {
          if (!item.link || seen.has(item.link)) continue;
          seen.add(item.link);
          const { title, company, location } = splitTitle(item.title);
          postings.push({
            sourceId: `eluta:${item.link}`,
            title,
            company,
            location,
            url: item.link,
            description: item.description,
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
      eligibility: eligibilityFromLocation(raw.location || 'Canada', 'Eluta RSS location'),
    };
  },
};
