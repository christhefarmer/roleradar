// resolveBoard mutation handler — probe the no-auth ATS board endpoints for
// a company's slug. Be a good citizen: a handful of cheap GETs with short
// timeouts, first hit wins.

interface ResolveEvent {
  arguments: { company: unknown };
}

interface ResolveResult {
  found: boolean;
  provider?: 'greenhouse' | 'lever' | 'ashby' | 'workable';
  slug?: string;
}

/** Candidate slugs from a company name: "Canada Life" → canadalife, canada-life. */
function slugCandidates(name: string): string[] {
  const cleaned = name
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|llc|co)\.?$/g, '')
    .trim();
  const squashed = cleaned.replace(/[^a-z0-9]+/g, '');
  const hyphenated = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [...new Set([squashed, hyphenated])].filter(Boolean);
}

async function ok(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

const PROBES: {
  provider: 'greenhouse' | 'lever' | 'ashby' | 'workable';
  url: (slug: string) => string;
}[] = [
  {
    provider: 'greenhouse',
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
  },
  {
    provider: 'lever',
    url: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json&limit=1`,
  },
  {
    provider: 'ashby',
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
  },
  {
    provider: 'workable',
    url: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`,
  },
];

export const handler = async (event: ResolveEvent): Promise<string> => {
  let raw: unknown = event.arguments?.company;
  for (let i = 0; i < 3 && typeof raw === 'string'; i++) {
    try {
      raw = JSON.parse(raw);
    } catch {
      break;
    }
  }
  const company = String(raw ?? '').trim();
  if (!company) return JSON.stringify({ found: false } satisfies ResolveResult);

  for (const slug of slugCandidates(company)) {
    for (const probe of PROBES) {
      if (await ok(probe.url(slug))) {
        return JSON.stringify({ found: true, provider: probe.provider, slug } satisfies ResolveResult);
      }
    }
  }
  return JSON.stringify({ found: false } satisfies ResolveResult);
};
