// resolveBoard mutation handler — probe the no-auth ATS board endpoints for
// a company's slug. Be a good citizen: a handful of cheap GETs with short
// timeouts, first hit wins.

interface ResolveEvent {
  arguments: { company: unknown };
}

type Provider = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'bamboohr';

interface ResolveResult {
  found: boolean;
  /** Every board the company has — companies often run more than one ATS. */
  boards: { provider: Provider; slug: string }[];
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

const PROBES: { provider: Provider; url: (slug: string) => string }[] = [
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
  {
    provider: 'smartrecruiters',
    url: (slug) => `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=1`,
  },
  {
    provider: 'bamboohr',
    url: (slug) => `https://${encodeURIComponent(slug)}.bamboohr.com/careers/list`,
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
  if (!company) return JSON.stringify({ found: false, boards: [] } satisfies ResolveResult);

  const candidates = slugCandidates(company);
  // Probe every provider in parallel — companies often run more than one ATS
  // (and sequential worst-case would outrun the function timeout).
  const results = await Promise.all(
    PROBES.map(async (probe) => {
      for (const slug of candidates) {
        if (await ok(probe.url(slug))) return { provider: probe.provider, slug };
      }
      return null;
    }),
  );
  const boards = results.filter((b): b is { provider: Provider; slug: string } => b !== null);
  return JSON.stringify({ found: boards.length > 0, boards } satisfies ResolveResult);
};
