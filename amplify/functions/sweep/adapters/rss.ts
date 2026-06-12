// Shared RSS parsing for aggregate feed adapters. Deliberately tolerant:
// feeds vary in which tags carry what, so we expose every child tag of each
// <item> and let the adapter pick its candidates.

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
