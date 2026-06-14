// Shared RSS parsing for aggregate feed adapters. Deliberately tolerant:
// feeds vary in which tags carry what, so we expose every child tag of each
// <item> and let the adapter pick its candidates.

/** Per-term aggregate-feed fan-out budget, shared so Eluta and Job Bank stay
 *  inside the sweep's 30s window even as the term cap rises. Each term is one
 *  feed fetch, so wall-time ≈ ceil(terms / FEED_CONCURRENCY) × per-fetch timeout. */
export const FEED_CONCURRENCY = 12;

// Browser-like request headers. CDN-fronted feeds — notably Job Bank behind
// Akamai — reject header-less server requests with a 403 or an HTML bot
// challenge, which parses to zero <item>s and looks like an empty feed. A
// realistic User-Agent plus an RSS/XML Accept keeps them serving the feed.
const FEED_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
};

/** Fetch a feed with browser-like headers and a bounded timeout. */
export function fetchFeed(url: string, timeoutMs = 8000): Promise<Response> {
  return fetch(url, { headers: FEED_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse every child tag of each <item> into a name → values map. */
export function parseItems(xml: string): Record<string, string[]>[] {
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

export function firstField(fields: Record<string, string[]>, names: string[]): string {
  for (const name of names) {
    const v = fields[name]?.find((x) => x.trim());
    if (v) return v.trim();
  }
  return '';
}

/** Some feeds pack "Job Title - Company - City, Province" into the title. */
export function splitFeedTitle(raw: string): { title: string; company: string; location: string } {
  const parts = raw.split(' - ').map((s) => s.trim());
  return {
    title: parts[0] ?? raw,
    company: parts[1] ?? '',
    location: parts.slice(2).join(' - '),
  };
}

/** A category/value that reads like "Winnipeg, MB" or "Toronto, Ontario". */
export function looksLikeLocation(s: string): boolean {
  return /,\s*(?:[A-Z]{2}|Alberta|British Columbia|Manitoba|Ontario|Quebec|Saskatchewan|Nova Scotia|New Brunswick)\b/i.test(
    s,
  );
}
