// Careers-URL → watchlist entry resolution (ARCHITECTURE.md §2): the owner
// pastes a careers URL and we parse provider + slug from it. Companies with
// no public ATS board fall back to a normalized-name guess (the adapters
// probe politely and skip boards that don't exist).

import type { WatchEntry } from '../domain/types';

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function normalizeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Parse a pasted careers URL into a watchlist entry. Returns null when the
 *  input doesn't look like a URL (treat it as a plain company name). */
export function resolveCareersUrl(input: string): WatchEntry | null {
  const text = input.trim();
  if (!/[./]/.test(text)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  // boards.greenhouse.io/{slug} · job-boards.greenhouse.io/{slug}
  if (/(^|\.)greenhouse\.io$/.test(host) && segments[0]) {
    const slug = segments[0] === 'embed' ? (url.searchParams.get('for') ?? '') : segments[0];
    if (slug) return { name: titleCase(slug), src: 'Greenhouse', slug };
  }
  // jobs.lever.co/{slug}
  if (/(^|\.)lever\.co$/.test(host) && segments[0]) {
    return { name: titleCase(segments[0]), src: 'Lever', slug: segments[0] };
  }
  // jobs.ashbyhq.com/{slug}
  if (/(^|\.)ashbyhq\.com$/.test(host) && segments[0]) {
    return { name: titleCase(segments[0]), src: 'Ashby', slug: segments[0] };
  }
  // apply.workable.com/{slug}
  if (/(^|\.)workable\.com$/.test(host) && segments[0] && segments[0] !== 'api') {
    return { name: titleCase(segments[0]), src: 'Workable', slug: segments[0] };
  }
  // {tenant}.wd{n}.myworkdayjobs.com/{lang?}/{site}
  const wd = host.match(/^([^.]+)\.(wd\d+)\.myworkdayjobs\.com$/);
  if (wd) {
    const site = segments.find((s) => !/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(s)) ?? segments[0] ?? '';
    // Workday needs {tenant, dc, site}; the adapter is on the roadmap — the
    // entry is captured now so the pull starts working the moment it ships.
    return { name: titleCase(wd[1]), src: 'Workday', slug: `${wd[1]}:${wd[2]}:${site}` };
  }
  return null;
}
