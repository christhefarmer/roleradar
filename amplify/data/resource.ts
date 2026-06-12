// Amplify Data (AppSync + DynamoDB) + AI Kit routes.
//
// Every model is owner-scoped: a user only ever reads/writes their own
// profile, search config, roles, proposals, and conversations
// (ARCHITECTURE.md §6). The AI conversation route gets *read* tools over
// these models; anything that writes goes through the Proposal queue and an
// explicit human Approve — never directly from the model.

import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { resolveBoard } from '../functions/resolve-board/resource';
import { sweep } from '../functions/sweep/resource';

// Keep model ids in one place; allow upgrade (ARCHITECTURE.md §3).
// Chat gets the strong model (the owner reads every word); the structured
// extraction routes ride a faster, cheaper one.
const CHAT_MODEL = a.ai.model('Claude Sonnet 4.6');
const FAST_MODEL = a.ai.model('Claude Haiku 4.5');

const schema = a.schema({
  // ----- per-account data ---------------------------------------------------
  Profile: a
    .model({
      resumeText: a.string(),
      linkedinText: a.string(),
      // Extracted strengths: [{ key, label, confidence, weight, bar, evidence }]
      strengths: a.json(),
      // Profile facts: seniority, location → eligibility default, etc.
      facts: a.json(),
      parsedAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  SearchConfig: a
    .model({
      // Term groups: [{ name, weight, terms: string[] }]
      termGroups: a.json(),
      // Watchlist entries: { company, provider, slug } — Workday adds
      // { tenant, dc, site }. Per-user "configuration" is the watchlist
      // itself, never credentials (ARCHITECTURE.md §2).
      watchlist: a.json(),
      pausedCompanies: a.string().array(),
      // The true "omit": filters roles out across every source.
      excludedCompanies: a.string().array(),
      // Aggregate-feed on/off switches keyed by adapter id.
      activeSources: a.json(),
      autonomy: a.enum(['conservative', 'balanced', 'wide']),
    })
    .authorization((allow) => [allow.owner()]),

  Role: a
    .model({
      // Stable id for dedup-merge across runs and across sources.
      sourceId: a.string().required(),
      title: a.string().required(),
      company: a.string().required(),
      location: a.string(),
      url: a.url(),
      rawDescription: a.string(),
      sourceName: a.string(),
      /** Posting-stated compensation, when the source exposes or mentions it. */
      salary: a.string(),
      // Heuristic hints, always with provenance (never presented as certainty):
      // { state: 'ca' | 'us', label, detail }
      eligibility: a.json(),
      eligibilityOverridden: a.boolean(),
      // { score, verdict, dims: { macos: 'hit' | ... }, notes, sentence, chips }
      fit: a.json(),
      // Phantom signal
      seenCount: a.integer(),
      firstSeen: a.datetime(),
      lastSeen: a.datetime(),
      seenRuns: a.boolean().array(),
      phantomMuted: a.boolean(),
      // Hidden gem: { subtype: 'content' | 'company', why, matches[] } | null
      gem: a.json(),
      gemDecision: a.enum(['pending', 'confirmed', 'dismissed']),
      pipelineStage: a.enum(['none', 'new', 'interested', 'applied', 'interview', 'offer', 'closed']),
      dismissed: a.boolean(),
      notes: a.string(),
    })
    .secondaryIndexes((index) => [index('sourceId')])
    .authorization((allow) => [allow.owner()]),

  Proposal: a
    .model({
      kind: a.enum(['expandSearch', 'addCompany', 'addSource', 'tuneWeight', 'autonomy', 'mutePhantom']),
      title: a.string().required(),
      rationale: a.string().required(),
      // Machine-readable payload the approval executes (e.g. { term, group }).
      payload: a.json(),
      status: a.enum(['pending', 'approved', 'dismissed']),
      resolvedNote: a.string(),
    })
    .authorization((allow) => [allow.owner()]),

  SweepRun: a
    .model({
      status: a.enum(['running', 'done', 'failed']),
      // Per-source progress the client subscribes to while a sweep runs.
      progress: a.json(),
      fetched: a.integer(),
      kept: a.integer(),
      phantoms: a.integer(),
      gems: a.integer(),
      summary: a.string(),
    })
    .authorization((allow) => [allow.owner()]),

  // ----- The sweep — Scouts on demand ---------------------------------------

  // Synchronous v1: the client sends its search config, the Lambda fans out
  // across adapters and returns normalized + scored postings; the client
  // persists them into owner-scoped Role rows. Upgrade path (ARCHITECTURE.md
  // §2): an async job writing progress to SweepRun behind an AppSync
  // subscription — needed once a sweep can outgrow AppSync's 30s resolver cap.
  startSweep: a
    .mutation()
    .arguments({
      // JSON: { terms: string[], watchlist: [...], excludedCompanies: [...],
      //         activeSources: string[] }
      config: a.json().required(),
    })
    .returns(a.json())
    .handler(a.handler.function(sweep))
    .authorization((allow) => [allow.authenticated()]),

  // Board discovery for the watchlist: probe Greenhouse/Lever/Ashby for a
  // company's public board so entries land with the right provider + slug.
  resolveBoard: a
    .mutation()
    .arguments({ company: a.string().required() })
    .returns(a.json())
    .handler(a.handler.function(resolveBoard))
    .authorization((allow) => [allow.authenticated()]),

  // ----- AI routes (Amplify AI Kit / Bedrock) -------------------------------

  // Conversation route — "Radar". Multi-turn, streaming, history persisted
  // per owner. Surface with useAIConversation; do not hand-roll the transport.
  // Read tools only: the bot answers from real records and *proposes* changes
  // by writing Proposal rows for the owner to approve in the queue.
  chat: a
    .conversation({
      aiModel: CHAT_MODEL,
      // Hard backstop on reply length; the style contract below aims well
      // under it so answers end cleanly rather than truncating.
      inferenceConfiguration: { maxTokens: 400, temperature: 0.4 },
      // NOTE: the systemPrompt is embedded into the generated GraphQL schema —
      // it must stay single-line (no raw newlines, no straight double quotes,
      // no backslashes) or backend synth fails with a GraphQL parse error.
      systemPrompt: [
        'You are Radar, a calm, precise job-hunt scout working for the owner of',
        'this account. Everything you know about the owner — their specialty,',
        'seniority, location, strengths — comes ONLY from the context snapshot',
        'attached to each message and from your tools; never assume who they are.',
        'GROUNDING (hard rules): every user message carries a JSON context snapshot',
        '(profile facts and strengths, search config, latest sweep summary, top',
        'visible roles, pending proposals). Answer ONLY from that snapshot plus',
        'tool results. If neither contains the answer, say plainly that the records',
        'do not show it — e.g. ‘my scouts have not seen that’. Never invent roles,',
        'companies, scores, dates, salaries, or résumé facts. Eligibility, fit and',
        'phantom flags are heuristic hints with provenance — present them as hints',
        'the owner can override, never as certainty. Stay on the owner’s job hunt;',
        'politely decline anything outside it.',
        'RESPONSE STYLE (hard rules): at most 60 words or 4 bullets per reply; full',
        'breakdowns only when the owner explicitly says expand, explain, walk me',
        'through, or details. Lead with the answer — no preamble, no restating the',
        'question, no narrating the snapshot, no pleasantries. Role lists are',
        'mono-terse lines like: Title @ Company — 87 · reach · CA. Verdict labels',
        'stand in for reasoning in lists; full reasoning is an expanded answer.',
        'End with at most one five-word expand offer, only when there is more.',
        'ACTING (product invariant): you never apply to roles, never contact',
        'anyone, and never change search state yourself. You propose; the owner',
        'approves in the queue. Tone: a well-built instrument — precise, technical,',
        'quiet.',
      ].join(' '),
      tools: [
        a.ai.dataTool({
          name: 'listRoles',
          description:
            'List the owner’s normalized roles with fit scores, verdicts, eligibility, phantom signals, gem flags and pipeline stages. The context snapshot already carries the top visible roles — use this tool when you need the full set or roles outside the snapshot.',
          model: a.ref('Role'),
          modelOperation: 'list',
        }),
        a.ai.dataTool({
          name: 'listProposals',
          description:
            'List Radar’s pending and resolved proposals (the approval queue).',
          model: a.ref('Proposal'),
          modelOperation: 'list',
        }),
        a.ai.dataTool({
          name: 'listSweepRuns',
          description: 'List recent Scout sweep runs and their summaries.',
          model: a.ref('SweepRun'),
          modelOperation: 'list',
        }),
        a.ai.dataTool({
          name: 'listProfile',
          description:
            'The owner’s résumé text, parsed strengths, and profile facts (seniority, location, work eligibility).',
          model: a.ref('Profile'),
          modelOperation: 'list',
        }),
        a.ai.dataTool({
          name: 'listSearchConfig',
          description:
            'The owner’s search term groups, company watchlist, paused and excluded companies, active sources, and autonomy setting.',
          model: a.ref('SearchConfig'),
          modelOperation: 'list',
        }),
      ],
    })
    .authorization((allow) => allow.owner()),

  // Generation route — résumé parse. Extracts strengths (mapped to the fit
  // dimensions), suggested search terms, and watchlist candidates. Heuristic
  // hints the owner confirms or edits — never overrides their judgment.
  parseProfile: a
    .generation({
      aiModel: FAST_MODEL,
      systemPrompt: [
        'You parse a résumé (and optional LinkedIn text) for a job-hunt scout and',
        'produce the scout\'s entire search range. Extract:',
        '(1) strengths — up to 8, each mapped to one fit dimension key (macos,',
        'intune, identity, security, build, client, level) with a short label,',
        'confidence HIGH | MED | RARE (RARE = an unusual edge worth cross-listing),',
        'a weight 1-3, a bar 0-100, and a short evidence quote lifted from the text;',
        '(2) termGroups — exactly three priority tiers: { name: High, weight: 3 },',
        '{ name: Med, weight: 2 }, { name: Low, weight: 1 }, each with',
        '{ terms: string[] } of 3-8 short queries a job board understands — job',
        'titles, technologies, certifications. High = the person\'s core lane,',
        'Med = strong adjacent, Low = stretch or peripheral;',
        '(3) suggestedTerms — extra terms worth considering beyond the groups;',
        '(4) suggestedCompanies — [{ name, reason }] employers worth watching,',
        'inferred from the text (vendors used, industries, named employers\' peers);',
        '(5) facts — { seniority, location, canadaEligible: boolean }.',
        'Be honest and grounded in the text; do not invent experience.',
      ].join(' '),
    })
    .arguments({
      resumeText: a.string().required(),
      linkedinText: a.string(),
    })
    .returns(
      a.customType({
        strengths: a.json().required(),
        termGroups: a.json(),
        suggestedTerms: a.string().array(),
        suggestedCompanies: a.json(),
        facts: a.json(),
      }),
    )
    .authorization((allow) => allow.authenticated()),

  // Generation route — structured fit explanation per role. One-shot, typed
  // output; powers the signature fit-with-reasoning card.
  generateFit: a
    .generation({
      aiModel: FAST_MODEL,
      systemPrompt: [
        'You score job postings against a specific owner profile. Compare the role',
        'description to the profile and return an honest, structured fit read. The',
        'dimensions to score arrive per request as a JSON list of { key, label }',
        'derived from the owner\'s parsed strengths — always score every provided',
        'key (which always includes level for seniority fit and eligible for work',
        'eligibility). Return dims as a map of each provided key to one of:',
        'hit | partial | thin | na (or us when blocked by US-only authorization),',
        'and notes as a map of the same keys to one short plain-language sentence',
        'each. The verdict sentence must be honest about stretches and gaps —',
        'transparency over decoration.',
      ].join(' '),
    })
    .arguments({
      roleDescription: a.string().required(),
      roleTitle: a.string().required(),
      roleLocation: a.string(),
      profile: a.string().required(),
      /** JSON [{ key, label }] — the owner's fit dimensions for this read. */
      dimensions: a.json(),
    })
    .returns(
      a.customType({
        score: a.integer().required(),
        verdict: a.enum(['match', 'reach', 'below', 'mismatch']),
        sentence: a.string().required(),
        dims: a.json().required(),
        notes: a.json(),
        chips: a.string().array(),
      }),
    )
    .authorization((allow) => allow.authenticated()),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
