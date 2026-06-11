// Eluta.ca — aggregate feed adapter (sanctioned RSS/OpenSearch, Canadian).
// A single public feed queried with the owner's weighted terms; no
// per-company config, just on/off. This is the firehose that surfaces roles
// outside the watchlist — with real Canadian locations, so eligibility is
// nearly free.

import {
  eligibilityFromLocation,
  extractSalary,
  type FetchConfig,
  type NormalizedRole,
  type RawPosting,
  type SourceAdapter,
} from './types';

// Eluta exposes OpenSearch-style RSS per query. The item parser below is
// deliberately tolerant: feeds vary in which tags carry the employer and
// location, so we read every child tag and pick the best candidates.
const FEED_URL = (term: string) => `https://www.eluta.ca/rss?q=${encodeURIComponent(term)}`;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse every child tag of each <item> into a name → values map. */
function parseItems(xml: string): Record<string, string[]>[] {
  const items: Record<string, string[]>[] = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/g;
  const tagRe = /<([\w:]+)(?:\s[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const fields: Record<string, string[]> = {};
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(m[1])) !== null) {
      const name = t[1].toLowerCase();
      (fields[name] ??= []).push(stripHtml(t[2]));
    }
    items.push(fields);
  }
  return items;
}

function first(fields: Record<string, string[]>, names: string[]): string {
  for (const name of names) {
    const v = fields[name]?.find((x) => x.trim());
    if (v) return v.trim();
  }
  return '';
}

/** Some feeds pack "Job Title - Company - City, Province" into the title. */
function splitTitle(raw: string): { title: string; company: string; location: string } {
  const parts = raw.split(' - ').map((s) => s.trim());
  return {
    title: parts[0] ?? raw,
    company: parts[1] ?? '',
    location: parts.slice(2).join(' - '),
  };
}

/** A category/value that reads like "Winnipeg, MB" or "Toronto, Ontario". */
function looksLikeLocation(s: string): boolean {
  return /,\s*(?:[A-Z]{2}|Alberta|British Columbia|Manitoba|Ontario|Quebec|Saskatchewan|Nova Scotia|New Brunswick)\b/i.test(
    s,
  );
}

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
          const link = first(fields, ['link', 'guid']);
          if (!link || seen.has(link)) continue;
          seen.add(link);

          const rawTitle = first(fields, ['title']);
          const fromTitle = splitTitle(rawTitle);
          const company =
            first(fields, ['dc:creator', 'creator', 'author', 'eluta:employer', 'employer', 'source']) ||
            fromTitle.company;
          const location =
            first(fields, ['eluta:location', 'location', 'region']) ||
            (fields['category'] ?? []).find(looksLikeLocation) ||
            fromTitle.location;
          const description = first(fields, ['description', 'content:encoded', 'summary']);

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
