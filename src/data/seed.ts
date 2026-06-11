// Seed data lifted verbatim from the design prototypes (docs/design/*.dc.html).
// It stands in for real Amplify Data records + Scout sweep results so the UI is
// running at full design fidelity before the backend is deployed. Once the
// sweep Lambda and AI routes are live, these become the empty-state defaults.

import type {
  DimKey,
  DiscoveryTrace,
  Gem,
  Proposal,
  Role,
  RunSource,
  SourceDef,
  Strength,
  SuggestedCompany,
  SuggestedTerm,
  TermGroup,
  WatchEntry,
} from '../domain/types';

export const DIMS: [DimKey, string][] = [
  ['macos', 'macOS · Jamf · endpoint'],
  ['intune', 'Intune · cross-platform'],
  ['identity', 'Identity · SSO · Okta'],
  ['security', 'Endpoint security'],
  ['build', 'AI · software build'],
  ['client', 'Client-facing'],
  ['level', 'Level fit'],
  ['eligible', 'Canada eligibility'],
];

export const ROLES: Role[] = [
  {
    id: 'onepass',
    title: 'Client Platform Engineer (Apple)',
    company: '1Password',
    location: 'Remote · Canada',
    posted: '2d',
    days: 2,
    source: 'Greenhouse',
    score: 94,
    verdict: 'match',
    dims: {
      macos: 'hit',
      intune: 'hit',
      identity: 'hit',
      security: 'hit',
      build: 'partial',
      client: 'partial',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      macos: 'Apple fleet at scale — the entire job.',
      identity: 'SSO/Okta integration explicitly listed.',
      build: 'Some internal tooling, not core.',
      client: 'Cross-team partnering, lightly client-facing.',
      level: 'IC / tech-lead — right at your level.',
    },
    chips: [
      ['+ Deep macOS/Jamf', 'good'],
      ['+ Identity & SSO', 'good'],
      ['+ Canada-eligible', 'good'],
    ],
    sentence:
      'Bullseye. This is your exact lane — Apple fleet at scale with Jamf and identity baked in, pitched at IC/tech-lead level. The only stretch is how much net-new React/AWS build you would actually get.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail:
        'Greenhouse location field reads “Canada (Remote)”. Confirmed Canada-eligible — high confidence.',
    },
  },
  {
    id: 'jamf',
    title: 'Senior Endpoint Engineer, macOS',
    company: 'Jamf',
    location: 'Remote · Canada',
    posted: '5d',
    days: 5,
    source: 'Lever',
    score: 91,
    verdict: 'match',
    dims: {
      macos: 'hit',
      intune: 'partial',
      identity: 'partial',
      security: 'hit',
      build: 'thin',
      client: 'partial',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      macos: 'Pure Jamf-native macOS engineering.',
      security: 'Hardening + baseline work front and centre.',
      build: 'Little software-build scope here.',
      level: 'Senior IC — squarely at level.',
    },
    chips: [
      ['+ Jamf-native', 'good'],
      ['+ Endpoint security', 'good'],
      ['− Light on build', 'warn'],
    ],
    sentence:
      'Working at the source. Pure macOS endpoint engineering at your level, with the security-baseline work right in your wheelhouse. Cross-platform/Intune is secondary and there is little net software-build.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Lever location “Remote, Canada”. Confirmed Canada-eligible.',
    },
  },
  {
    id: 'wealth',
    title: 'Identity & Access Engineer (Okta)',
    company: 'Wealthsimple',
    location: 'Toronto · Remote CA',
    posted: '1d',
    days: 1,
    source: 'Ashby',
    score: 88,
    verdict: 'match',
    dims: {
      macos: 'partial',
      intune: 'partial',
      identity: 'hit',
      security: 'hit',
      build: 'partial',
      client: 'thin',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      identity: 'Okta/SSO is the centre of gravity.',
      macos: 'Device work is present but not primary.',
      security: 'Conditional-access + posture work.',
      level: 'Senior IC, identity-forward.',
    },
    chips: [
      ['+ Identity/SSO core', 'good'],
      ['+ Security', 'good'],
      ['− Less endpoint-centric', 'warn'],
    ],
    sentence:
      'Strong adjacent match. Leans identity/SSO over device management, so you would flex your Okta depth more than Jamf. At-level IC role, Canada-based — a good fit if you want to pivot toward identity.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Ashby location “Canada — Remote / Toronto”. Confirmed Canada-eligible.',
    },
  },
  {
    id: 'ninja',
    title: 'Solutions Engineer, Endpoint',
    company: 'NinjaOne',
    location: 'Remote · Canada',
    posted: '3d',
    days: 3,
    source: 'Greenhouse',
    score: 86,
    verdict: 'match',
    dims: {
      macos: 'hit',
      intune: 'hit',
      identity: 'partial',
      security: 'hit',
      build: 'partial',
      client: 'hit',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      client: 'Client-facing demos/POCs are the job.',
      macos: 'Cross-platform incl. strong Apple story.',
      build: 'Light scripting/automation for demos.',
      level: 'Senior pre-sales — at level.',
    },
    chips: [
      ['+ Client-facing', 'good'],
      ['+ Cross-platform endpoint', 'good'],
      ['+ Speaker credibility fits', 'good'],
    ],
    sentence:
      'Pre-sales done right. Client-facing endpoint expertise is the role — your consulting instinct and conference-speaking translate directly. Broad MDM coverage; less hands-on engineering, more demo and POC.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Greenhouse location “Canada (Remote)”. Confirmed Canada-eligible.',
    },
  },
  {
    id: 'shopify',
    title: 'Staff Client Platform Engineer',
    company: 'Shopify',
    location: 'Remote · Canada',
    posted: '6d',
    days: 6,
    source: 'Greenhouse',
    score: 84,
    verdict: 'reach',
    dims: {
      macos: 'hit',
      intune: 'hit',
      identity: 'hit',
      security: 'hit',
      build: 'hit',
      client: 'partial',
      level: 'partial',
      eligible: 'hit',
    },
    notes: {
      build: 'They genuinely value the React/AWS side.',
      level: '“Staff” implies broad org scope — a stretch.',
      macos: 'Large heterogeneous fleet.',
    },
    chips: [
      ['+ Hits every dimension', 'good'],
      ['+ AI/build valued', 'good'],
      ['− Staff scope is a stretch', 'warn'],
    ],
    sentence:
      'A reach worth taking. The stack matches you perfectly and they actually reward the software-build side. “Staff” implies org-wide influence beyond your current scope — a stretch on scale and leadership, not on skills.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Greenhouse location “Canada (Remote)”. Confirmed Canada-eligible.',
    },
  },
  {
    id: 'hootsuite',
    title: 'Senior Systems Engineer (Apple Fleet)',
    company: 'Hootsuite',
    location: 'Vancouver · Remote CA',
    posted: 'seen 94d',
    days: 94,
    source: 'Eluta RSS',
    score: 82,
    verdict: 'match',
    dims: {
      macos: 'hit',
      intune: 'partial',
      identity: 'partial',
      security: 'partial',
      build: 'partial',
      client: 'thin',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      macos: 'Clean Apple-fleet match on paper.',
      level: 'Senior IC — at level.',
    },
    chips: [
      ['+ Apple fleet', 'good'],
      ['+ At-level', 'good'],
      ['⚠ Likely phantom', 'bad'],
    ],
    sentence:
      'Skills-wise a clean match — but this one has appeared on nearly every run for over three months. Strong signal it is an evergreen req that is not really hiring. Worth a low-effort ping at most, not a serious application until it shows movement.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Eluta RSS location “Vancouver, BC / Remote Canada”. Canada-eligible.',
    },
    phantom: { seen: 6, days: 94, runs: [true, true, false, true, true, true, false, true] },
  },
  {
    id: 'pcc',
    title: 'EUC Engineer, Intune',
    company: 'PointClickCare',
    location: 'Mississauga · Hybrid',
    posted: '4d',
    days: 4,
    source: 'Workday',
    score: 79,
    verdict: 'match',
    dims: {
      macos: 'thin',
      intune: 'hit',
      identity: 'partial',
      security: 'partial',
      build: 'thin',
      client: 'partial',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      intune: 'Intune / modern-workplace is the core.',
      macos: 'macOS is a small slice of the fleet.',
      level: 'At level, but Windows-weighted.',
    },
    chips: [
      ['+ Intune/EUC core', 'good'],
      ['− macOS minor here', 'warn'],
      ['− Hybrid (Mississauga)', 'warn'],
    ],
    sentence:
      'Solid but Windows-leaning. Intune and modern-workplace work you can do in your sleep, but macOS is a small slice — you would use less of your Apple depth. Hybrid in Mississauga, so weigh the commute/relocation angle.',
    elig: {
      state: 'ca',
      label: 'CA · HYBRID',
      detail:
        'Workday location “Mississauga, ON”. Canada-eligible, but on-site/hybrid — not fully remote.',
    },
  },
  {
    id: 'absolute',
    title: 'Endpoint Security Analyst',
    company: 'Absolute Security',
    location: 'Vancouver · Remote CA',
    posted: '8d',
    days: 8,
    source: 'Lever',
    score: 76,
    verdict: 'match',
    dims: {
      macos: 'partial',
      intune: 'partial',
      identity: 'partial',
      security: 'hit',
      build: 'thin',
      client: 'partial',
      level: 'partial',
      eligible: 'hit',
    },
    notes: {
      security: 'Baseline/posture work fits well.',
      level: '“Analyst” reads a notch below you.',
      macos: 'Cross-platform, shallow on Apple depth.',
    },
    chips: [
      ['+ Security baselines', 'good'],
      ['− “Analyst” reads junior', 'warn'],
      ['− Light macOS depth', 'warn'],
    ],
    sentence:
      'Security-forward, slightly under. The endpoint-security baseline work fits, but the “Analyst” framing reads a notch below your level and spans platforms broadly. Decent if the real team scope is bigger than the title suggests.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Lever location “Vancouver / Remote Canada”. Canada-eligible.',
    },
  },
  {
    id: 'coveo',
    title: 'IT Support Specialist II',
    company: 'Coveo',
    location: 'Québec City · Hybrid',
    posted: '2d',
    days: 2,
    source: 'Eluta RSS',
    score: 48,
    verdict: 'below',
    dims: {
      macos: 'partial',
      intune: 'thin',
      identity: 'thin',
      security: 'thin',
      build: 'na',
      client: 'partial',
      level: 'thin',
      eligible: 'hit',
    },
    notes: {
      level: 'Tier-2 support — well below your level.',
      macos: 'Mac-heavy office, but hands-off depth.',
      build: 'No software-build component.',
    },
    chips: [
      ['− Below your level', 'bad'],
      ['− Help-desk scope', 'warn'],
      ['+ Apple-friendly shop', 'good'],
    ],
    sentence:
      'Below the line. This is tier-2 support, not engineering — you would be over-qualified and under-utilised, so it is down-ranked. The one upside: Coveo runs a Mac-heavy office, which confirms it as a watchlist target.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Eluta RSS location “Québec City / Hybrid”. Canada-eligible.',
    },
    down: true,
  },
  {
    id: 'telus',
    title: 'Network Infrastructure Engineer',
    company: 'TELUS',
    location: 'Calgary · Hybrid',
    posted: '7d',
    days: 7,
    source: 'Eluta RSS',
    score: 31,
    verdict: 'mismatch',
    dims: {
      macos: 'na',
      intune: 'na',
      identity: 'thin',
      security: 'partial',
      build: 'na',
      client: 'thin',
      level: 'hit',
      eligible: 'hit',
    },
    notes: {
      security: 'Some network-security overlap only.',
      macos: 'No endpoint/Apple content.',
      level: 'At level, wrong specialty.',
    },
    chips: [
      ['− Networking-core', 'bad'],
      ['− Domain mismatch', 'bad'],
    ],
    sentence:
      'Wrong domain. Routing, switching and datacentre networking — adjacent to IT but not your endpoint/Apple specialty. At level and Canada-based, but the day-to-day would not use your strengths. Down-ranked.',
    elig: {
      state: 'ca',
      label: 'CA ✓',
      detail: 'Eluta RSS location “Calgary, AB / Hybrid”. Canada-eligible.',
    },
    down: true,
  },
  {
    id: 'tailscale',
    title: 'Endpoint Management Engineer',
    company: 'Tailscale',
    location: 'Remote · US only',
    posted: '1d',
    days: 1,
    source: 'Greenhouse',
    score: 73,
    verdict: 'match',
    dims: {
      macos: 'hit',
      intune: 'hit',
      identity: 'hit',
      security: 'partial',
      build: 'partial',
      client: 'partial',
      level: 'hit',
      eligible: 'us',
    },
    notes: {
      macos: 'Strong cross-platform endpoint fit.',
      identity: 'Device identity + SSO work.',
      eligible: 'Posting requires US work authorization.',
    },
    chips: [
      ['✕ US-authorization only', 'bad'],
      ['+ Great skill fit otherwise', 'good'],
    ],
    sentence:
      'So close, wrong country. The role itself is a strong fit, but the posting requires US work authorization — Greenhouse location reads “United States (Remote)”. Flagged ineligible. Keep Tailscale on your watchlist for a future Canada/global req.',
    elig: {
      state: 'us',
      label: 'US ONLY',
      detail:
        'Greenhouse location “United States (Remote)”. Requires US authorization — override only if you hold it.',
    },
    down: true,
  },
];

export const GEMS: Gem[] = [
  {
    id: 'benevity',
    title: 'Modern Workplace Lead',
    company: 'Benevity',
    location: 'Calgary · Remote CA',
    source: 'Greenhouse',
    subtype: 'CONTENT MATCH',
    fit: 85,
    whyLabel: 'WHY IT SURFACED — TITLE MISSED YOUR TERMS',
    whyText:
      'Your terms never mention “Modern Workplace”, so a title search skips it entirely. But the description is ~78% your stack and reads like an endpoint-lead role wearing a generic title — at or slightly above your level.',
    matches: ['Jamf', 'Intune', 'macOS baseline', 'Okta', 'Conditional Access', 'endpoint'],
    elig: { state: 'ca', label: 'CA ✓' },
  },
  {
    id: 'dialpad',
    title: 'Technical Implementation Consultant',
    company: 'Dialpad',
    location: 'Remote · Canada',
    source: 'Ashby',
    subtype: 'CONTENT MATCH',
    fit: 74,
    whyLabel: 'WHY IT SURFACED — TITLE MISSED YOUR TERMS',
    whyText:
      "Doesn't match any “engineer” term you search — but the JD is endpoint rollouts and MDM onboarding for enterprise clients. Your consulting + speaking background fits; less deep engineering, more delivery.",
    matches: ['MDM', 'device onboarding', 'SSO', 'client-facing'],
    elig: { state: 'ca', label: 'CA ✓' },
  },
  {
    id: 'clio',
    title: 'IT Operations Generalist',
    company: 'Clio',
    location: 'Burnaby · Remote CA',
    source: 'Lever',
    subtype: 'COMPANY SIGNAL',
    fit: 71,
    whyLabel: 'WHY IT SURFACED — COMPANY FLEET SIGNAL',
    whyText:
      'The title is broad and the JD is vague — but Clio is a known Jamf shop running a ~2,000-device Apple-heavy fleet. The company profile says your skills would dominate here. Worth a look to see if the role can be shaped toward endpoint.',
    matches: ['Apple-heavy fleet', 'Known Jamf customer', '~2,000 devices'],
    elig: { state: 'ca', label: 'CA ✓' },
  },
];

export const TERM_GROUPS: TermGroup[] = [
  {
    name: 'Apple / endpoint',
    weight: 3,
    terms: ['macOS engineer', 'Apple endpoint', 'Jamf', 'MDM', 'client platform engineering'],
  },
  {
    name: 'Cross-platform / EUC',
    weight: 2,
    terms: ['Intune', 'EUC', 'modern workplace', 'endpoint management'],
  },
  {
    name: 'Identity & security',
    weight: 2,
    terms: ['SSO', 'Okta', 'identity', 'endpoint security', 'conditional access'],
  },
  {
    name: 'Client-facing',
    weight: 2,
    terms: ['solutions engineer', 'implementation engineer', 'pre-sales engineer', 'sales engineer'],
  },
];

export const WATCHLIST: WatchEntry[] = [
  { name: 'Jamf', src: 'Lever' },
  { name: '1Password', src: 'Greenhouse' },
  { name: 'NinjaOne', src: 'Greenhouse' },
  { name: 'Tailscale', src: 'Greenhouse' },
  { name: 'Shopify', src: 'Greenhouse' },
  { name: 'Wealthsimple', src: 'Ashby' },
  { name: 'Clio', src: 'Lever' },
  { name: 'Benevity', src: 'Greenhouse' },
  { name: 'Dialpad', src: 'Ashby' },
  { name: 'Absolute Security', src: 'Lever' },
  { name: 'PointClickCare', src: 'Workday' },
  { name: 'Hootsuite', src: 'RSS' },
  { name: 'Province of Manitoba', src: 'Workday' },
  { name: 'University of Manitoba', src: 'Workday' },
];

export const SOURCES: SourceDef[] = [
  { name: 'Greenhouse', note: 'ATS JSON · watchlist companies', tag: 'ACTIVE', on: true },
  { name: 'Lever', note: 'ATS JSON · watchlist companies', tag: 'ACTIVE', on: true },
  { name: 'Ashby', note: 'ATS JSON · watchlist companies', tag: 'ACTIVE', on: true },
  { name: 'Workday', note: 'ATS JSON · watchlist companies', tag: 'ACTIVE', on: true },
  { name: 'Eluta.ca', note: 'Sanctioned RSS / OpenSearch · Canada', tag: 'ACTIVE', on: true },
  { name: 'We Work Remotely', note: 'RSS · remote-first', tag: 'ACTIVE', on: true },
  { name: 'Remotive', note: 'JSON · remote-first', tag: 'OFF', on: false },
  { name: 'Job Bank (Canada)', note: 'Gov of Canada · sanctioned XML feed', tag: 'ACTIVE', on: true },
  { name: 'Adzuna', note: 'Sanctioned API · Canada-filtered aggregate', tag: 'ACTIVE', on: true },
  { name: 'Remote OK', note: 'JSON API · remote-first', tag: 'OFF', on: false },
  { name: 'Hacker News · Who is hiring', note: 'HN Algolia API · gem feeder', tag: 'OFF', on: false },
  { name: 'LinkedIn', note: 'Manual — paste roles from email alerts', tag: 'MANUAL', on: true },
];

export const RUN_SRC: Omit<RunSource, 'status'>[] = [
  { name: 'Greenhouse', detail: 'ATS JSON · 12 watchlist companies', count: '8 roles', kind: 'auto' },
  { name: 'Lever', detail: 'ATS JSON · watchlist', count: '4 roles', kind: 'auto' },
  { name: 'Ashby', detail: 'ATS JSON · watchlist', count: '3 roles', kind: 'auto' },
  { name: 'Workday', detail: 'ATS JSON · watchlist', count: '2 roles', kind: 'auto' },
  { name: 'Eluta.ca RSS', detail: 'Sanctioned Canadian aggregate', count: '9 roles', kind: 'auto' },
  { name: 'We Work Remotely', detail: 'Remote-first RSS', count: '3 roles', kind: 'auto' },
  { name: 'Remotive', detail: 'Remote-first JSON', count: '2 roles', kind: 'auto' },
  { name: 'LinkedIn', detail: 'Manual alert inbox — no automated pull', count: 'manual', kind: 'manual' },
];

export const PIPE_STAGES: [key: string, label: string, dot: string][] = [
  ['new', 'NEW', '#97907F'],
  ['interested', 'INTERESTED', '#8A5E14'],
  ['applied', 'APPLIED', '#1E8A4F'],
  ['interview', 'INTERVIEW', '#0F6B3B'],
  ['offer', 'OFFER', '#6B4FA8'],
  ['closed', 'CLOSED', '#B8B0A0'],
];

export const STRENGTHS: Strength[] = [
  {
    key: 'macos',
    label: 'macOS · Jamf · endpoint',
    conf: 'HIGH',
    weight: 3,
    bar: 96,
    ev: 'Jamf Pro admin across a 4,000-Mac fleet — zero-touch enrollment, app lifecycle, policy.',
  },
  {
    key: 'intune',
    label: 'Intune · cross-platform MDM',
    conf: 'HIGH',
    weight: 2,
    bar: 82,
    ev: 'Intune co-management; Windows + macOS compliance baselines.',
  },
  {
    key: 'identity',
    label: 'Identity · SSO · Okta',
    conf: 'HIGH',
    weight: 2,
    bar: 80,
    ev: 'Okta SSO rollout, SCIM provisioning, conditional access policies.',
  },
  {
    key: 'security',
    label: 'Endpoint security · baselines',
    conf: 'HIGH',
    weight: 2,
    bar: 78,
    ev: 'CIS macOS baselines, FileVault, EDR deployment & incident response.',
  },
  {
    key: 'build',
    label: 'AI · software build (React/TS/AWS)',
    conf: 'RARE',
    weight: 2,
    bar: 70,
    ev: 'Ships production React/TypeScript apps on AWS Amplify Gen 2.',
  },
  {
    key: 'client',
    label: 'Client-facing · consulting',
    conf: 'MED',
    weight: 1,
    bar: 62,
    ev: 'Two-time conference speaker (JNUC, MacAdmins); vendor & consulting engagements.',
  },
  {
    key: 'level',
    label: 'Seniority',
    conf: 'HIGH',
    weight: 1,
    bar: 90,
    ev: '25+ years; led enterprise endpoint deployments end-to-end.',
  },
];

export const SUG_TERMS: SuggestedTerm[] = [
  { label: 'client platform engineer', added: true },
  { label: 'Jamf', added: true },
  { label: 'conditional access', added: true },
  { label: 'endpoint security engineer', added: false },
  { label: 'Okta administrator', added: false },
  { label: 'Apple device management', added: false },
  { label: 'EUC engineer', added: false },
  { label: 'macOS systems engineer', added: false },
];

export const SUG_COS: SuggestedCompany[] = [
  { name: 'SAP', reason: 'Large enterprise Jamf customer — Apple-heavy fleet' },
  { name: 'GitLab', reason: 'All-remote; documented macOS fleet & MDM' },
  { name: 'Later', reason: 'Apple-first shop, Vancouver — close to your region' },
];

export const GUARDRAILS = [
  'Never auto-applies',
  'No outreach or messages',
  'Canada-eligibility enforced',
  'Every change needs your OK',
];

export const RADAR_STAGES = [
  { key: 'scan', label: 'SCAN' },
  { key: 'reason', label: 'REASON' },
  { key: 'expand', label: 'EXPAND' },
  { key: 'surface', label: 'SURFACE' },
  { key: 'learn', label: 'LEARN' },
];

export const TRACES: DiscoveryTrace[] = [
  {
    from: 'macOS · Jamf (core)',
    count: 3,
    hyp: 'Companies running Jamf often title their endpoint lead generically. I matched “Modern Workplace” and “Workspace” roles on description content — not your title terms — then Canada-filtered.',
    finds: ['Modern Workplace Lead @ Benevity', '+2 more'],
  },
  {
    from: 'AWS Amplify · React (rare edge)',
    count: 1,
    hyp: 'Almost no one in your niche also ships software. I cross-listed “platform engineer” roles at Apple-fleet shops where that build credibility is rewarded, not ignored.',
    finds: ['Staff Client Platform Engineer @ Shopify'],
  },
  {
    from: 'Okta · SSO depth',
    count: 1,
    hyp: 'Identity engineering is one hop from endpoint. I widened to “IAM / Access Engineer” titles at Canadian employers and ranked on your SSO evidence.',
    finds: ['Identity & Access Engineer @ Wealthsimple'],
  },
];

export const PROPOSALS: Proposal[] = [
  {
    id: 'p_term',
    kind: 'EXPAND SEARCH',
    tone: 'good',
    title: 'Add search term: “Workspace Engineer”',
    rationale:
      '3 roles matched this title on Jamf/Intune content but never under your current terms. Adding it widens the net without adding noise.',
    ok: 'Approved — added to your Cross-platform group.',
  },
  {
    id: 'p_watch',
    kind: 'ADD COMPANY',
    tone: 'good',
    title: 'Watch company: Coveo',
    rationale:
      'You dismissed their support role — but its description revealed a Mac-heavy fleet. Watching catches a future engineering req the moment it posts.',
    ok: 'Approved — Coveo added to your watchlist.',
  },
  {
    id: 'p_source',
    kind: 'ADD SOURCE',
    tone: 'good',
    title: 'Enable source: Vidyard (Ashby board)',
    rationale:
      'Vidyard posts endpoint roles only on their own Ashby board, not on aggregators. A direct pull catches them before they reach LinkedIn.',
    ok: 'Approved — Vidyard board now in your sources.',
  },
  {
    id: 'p_tune',
    kind: 'TUNE WEIGHT',
    tone: 'warn',
    title: 'Down-weight “Support / Help-desk” titles',
    rationale:
      'You have dismissed 4 below-level support roles. I can auto-down-rank that title pattern so they stop crowding your ranked list.',
    ok: 'Approved — support-tier titles will rank lower.',
  },
  {
    id: 'p_auto',
    kind: 'AUTONOMY',
    tone: 'warn',
    title: 'Raise autonomy to Wide for vendor boards',
    rationale:
      'Your watchlist is vendor-heavy and stable. Wide mode lets me hypothesise new Apple-heavy companies to watch — still nothing applied or contacted without you.',
    ok: 'Approved — autonomy raised to Wide.',
  },
  {
    id: 'p_phantom',
    kind: 'MUTE PHANTOM',
    tone: 'bad',
    title: 'Mute phantom: Senior Systems Engineer @ Hootsuite',
    rationale:
      'Seen 6× over 94 days and never moved. I can mute it until the posting actually changes, so it stops resurfacing on every sweep.',
    ok: 'Approved — muted until the posting changes.',
  },
];

export const RESUME_TEXT = `SENIOR IT SPECIALIST — Winnipeg, MB, Canada
25+ years in enterprise IT, specializing in Apple/macOS endpoint management.

CORE
• Jamf Pro administration across a 4,000-Mac fleet — zero-touch enrollment, app lifecycle, policy.
• Microsoft Intune co-management; Windows + macOS compliance baselines.
• Identity & access: Okta SSO rollout, SCIM provisioning, conditional access.
• Endpoint security: CIS macOS baselines, FileVault, EDR deployment & incident response.
• Software build: ships production React/TypeScript apps on AWS Amplify Gen 2.

EXPERIENCE
• Led enterprise endpoint deployments end-to-end for 10+ years.
• Two-time conference speaker (JNUC, MacAdmins).

ELIGIBILITY
• Canadian citizen, based in Winnipeg, MB. Eligible to work in Canada.`;

// Mobile bot — featured match card + sweep sources + escape-hatch links.
export const FEATURED_MATCH = {
  title: 'Client Platform Engineer (Apple)',
  meta: '1Password · Remote · Canada · 2d ago',
  score: 94,
  reasons: ['+ Deep macOS/Jamf', '+ Identity & SSO'],
};

export const MOBILE_SWEEP: { name: string; count: string }[] = [
  { name: 'Greenhouse', count: '8' },
  { name: 'Lever', count: '4' },
  { name: 'Ashby', count: '3' },
  { name: 'Eluta.ca RSS', count: '9' },
  { name: 'We Work Remotely', count: '3' },
];

export const MOBILE_PROPOSAL_IDS = ['p_term', 'p_watch', 'p_phantom'];

export const MOBILE_PROPOSALS: Proposal[] = [
  {
    id: 'p_term',
    kind: 'EXPAND SEARCH',
    tone: 'good',
    title: 'Add term: “Workspace Engineer”',
    rationale: 'Surfaces 3 roles your current terms miss — no extra noise.',
    ok: 'Added to your search terms.',
  },
  {
    id: 'p_watch',
    kind: 'ADD COMPANY',
    tone: 'good',
    title: 'Watch company: Coveo',
    rationale: 'A Mac-heavy fleet showed up in their JD. Catch the next engineering req early.',
    ok: 'Coveo added to watchlist.',
  },
  {
    id: 'p_phantom',
    kind: 'MUTE PHANTOM',
    tone: 'bad',
    title: 'Mute: Hootsuite Apple Fleet',
    rationale: 'Seen 6× over 94 days, never moves. Mute until it changes.',
    ok: 'Muted until it changes.',
  },
];
