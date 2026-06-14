// verifyBoard mutation handler — probe ONE ATS board endpoint for an exact
// provider + slug and report reachability. Reachable-only: we read the HTTP
// status, never the body, so a single cheap GET (or POST for Workday) answers
// "is this board live?". Mirrors resolve-board's polite-citizen probing.

type Provider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'smartrecruiters'
  | 'bamboohr'
  | 'workday';

interface VerifyEvent {
  arguments: { provider: unknown; slug: unknown };
}

interface VerifyResult {
  ok: boolean;
  status: number | null;
}

// GET-probe URL per provider — same endpoints resolve-board uses. limit=1 is
// fine here: we only inspect res.ok, never the payload.
const GET_PROBES: Record<string, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
  lever: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json&limit=1`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
  workable: (slug) => `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(slug)}`,
  smartrecruiters: (slug) =>
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=1`,
  bamboohr: (slug) => `https://${encodeURIComponent(slug)}.bamboohr.com/careers/list`,
};

/** Workday stores its board as `tenant:dc:site` (lib/ats.ts) and needs a POST. */
async function verifyWorkday(slug: string): Promise<VerifyResult> {
  const [tenant, dc, site] = slug.split(':');
  if (!tenant || !dc || !site) return { ok: false, status: null };
  try {
    const res = await fetch(
      `https://${tenant}.${dc}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' }),
        signal: AbortSignal.timeout(6000),
      },
    );
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: null };
  }
}

function unwrap(value: unknown): string {
  let raw = value;
  for (let i = 0; i < 3 && typeof raw === 'string'; i++) {
    try {
      raw = JSON.parse(raw);
    } catch {
      break;
    }
  }
  return String(raw ?? '').trim();
}

export const handler = async (event: VerifyEvent): Promise<string> => {
  const provider = unwrap(event.arguments?.provider).toLowerCase() as Provider;
  const slug = unwrap(event.arguments?.slug);
  if (!provider || !slug) {
    return JSON.stringify({ ok: false, status: null } satisfies VerifyResult);
  }

  if (provider === 'workday') {
    return JSON.stringify(await verifyWorkday(slug));
  }

  const build = GET_PROBES[provider];
  if (!build) return JSON.stringify({ ok: false, status: null } satisfies VerifyResult);

  try {
    const res = await fetch(build(slug), { signal: AbortSignal.timeout(6000) });
    return JSON.stringify({ ok: res.ok, status: res.status } satisfies VerifyResult);
  } catch {
    return JSON.stringify({ ok: false, status: null } satisfies VerifyResult);
  }
};
