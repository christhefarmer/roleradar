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

// Keep the model id in one place; allow upgrade (ARCHITECTURE.md §3).
const AI_MODEL = a.ai.model('Claude Sonnet 4.6');

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
      aiModel: AI_MODEL,
      systemPrompt: [
        'You are Radar, a calm, precise job-hunt scout for one specific senior IT',
        'specialist (Apple/macOS endpoint management — Jamf, Intune, MDM, identity/SSO —',
        'plus React/TypeScript/AWS build credibility; Winnipeg, Canada-eligible).',
        'Ground every answer in the owner’s records via your tools — top matches,',
        'hidden gems, phantoms, proposals, pipeline. Always explain fit scores in plain',
        'language with their per-dimension reasoning; never present a score without its',
        'why. Eligibility, fit and phantom flags are heuristic hints with provenance,',
        'not certainty. You never apply to roles, never contact anyone, and never',
        'change search state yourself: you propose, and the owner approves. Keep the',
        'tone of a well-built instrument: precise, technical, quiet.',
      ].join(' '),
      tools: [
        a.ai.dataTool({
          name: 'listRoles',
          description:
            'List the owner’s normalized roles with fit scores, verdicts, eligibility, phantom signals, gem flags and pipeline stages.',
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
      ],
    })
    .authorization((allow) => allow.owner()),

  // Generation route — résumé parse. Extracts strengths (mapped to the fit
  // dimensions), suggested search terms, and watchlist candidates. Heuristic
  // hints the owner confirms or edits — never overrides their judgment.
  parseProfile: a
    .generation({
      aiModel: AI_MODEL,
      systemPrompt: [
        'You parse a résumé (and optional LinkedIn text) for a job-hunt scout.',
        'Extract: (1) strengths — up to 8, each mapped to one fit dimension key',
        '(macos, intune, identity, security, build, client, level) with a short',
        'label, confidence HIGH | MED | RARE (RARE = an unusual edge worth',
        'cross-listing), a weight 1-3, a bar 0-100, and a short evidence quote',
        'lifted from the text; (2) suggestedTerms — job-search terms this person',
        'should query; (3) suggestedCompanies — [{ name, reason }] employers worth',
        'watching; (4) facts — { seniority, location, canadaEligible: boolean }.',
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
      aiModel: AI_MODEL,
      systemPrompt: [
        'You score job postings against a specific owner profile. Compare the role',
        'description to the profile strengths and return an honest, structured fit',
        'read. Dimensions: macos, intune, identity, security, build, client, level,',
        'eligible. For each dimension return hit | partial | thin | na (or us when',
        'blocked by US-only authorization) plus a short plain-language note. The',
        'verdict sentence must be honest about stretches and gaps — transparency over',
        'decoration.',
      ].join(' '),
    })
    .arguments({
      roleDescription: a.string().required(),
      roleTitle: a.string().required(),
      roleLocation: a.string(),
      profile: a.string().required(),
    })
    .returns(
      a.customType({
        score: a.integer().required(),
        verdict: a.enum(['match', 'reach', 'below', 'mismatch']),
        sentence: a.string().required(),
        dims: a.json().required(),
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
