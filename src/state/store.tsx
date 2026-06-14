// Global app state. In design-fidelity mode (no amplify_outputs.json) the
// store runs on the prototype seed exactly as before. In connected mode the
// same reducer drives the UI, but state hydrates from Amplify Data after
// Cognito sign-in and every meaningful action is persisted back through
// src/data/remote.ts — the empty-account → populate-preferences → sweep loop.
//
// Product invariant carried through every action here: Radar proposes, the
// owner approves. The only mutations that "act for" the bot are the ones
// behind approveProposal.

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  AuthMode,
  Autonomy,
  ChatMessage,
  Gem,
  PipelineStageKey,
  Proposal,
  Role,
  RunSource,
  SourceDef,
  Strength,
  SuggestedCompany,
  SuggestedTerm,
  SweepSummary,
  TermGroup,
  ViewKey,
  WatchEntry,
} from '../domain/types';
import {
  GEMS,
  PROPOSALS,
  RESUME_TEXT,
  ROLES,
  RUN_SRC,
  SOURCES,
  STRENGTHS,
  SUG_COS,
  SUG_TERMS,
  TERM_GROUPS,
  WATCHLIST,
} from '../data/seed';
import { botReply } from '../data/botReplies';
import { buildChatContext } from '../data/aiContext';
import { hiddenRoles, sweepSummaryLine } from './selectors';
import { isConnected } from '../lib/amplify';
import * as auth from '../auth/authService';
import * as remote from '../data/remote';

export interface AppState {
  connected: boolean;
  /** Connected mode boots by checking the Cognito session. */
  boot: 'checking' | 'ready';
  view: ViewKey;
  // Sweep (the agentic run)
  running: boolean;
  runSources: RunSource[];
  runDone: boolean;
  runError: boolean;
  runSummary: string;
  radarStage: number;
  summary: SweepSummary;
  // Roles & gems (seed in design mode; Amplify Data in connected mode)
  roles: Role[];
  gems: Gem[];
  // Recommended filters
  expanded: Record<string, boolean>;
  canadaOnly: boolean;
  hideBelow: boolean;
  sortBy: 'fit' | 'new';
  dismissed: Record<string, boolean>;
  overrides: Record<string, boolean>;
  // Search & watchlist
  termGroups: TermGroup[];
  watchlist: WatchEntry[];
  watchPaused: Record<string, boolean>;
  excluded: string[];
  sources: SourceDef[];
  // Gems & pipeline
  gemDecisions: Record<string, 'confirmed' | 'dismissed'>;
  pipeline: Record<string, PipelineStageKey>;
  // Profile
  resumeText: string;
  linkedinText: string;
  parsed: boolean;
  parsing: boolean;
  /** Why the last AI parse fell back to keywords (null = AI parse ok). */
  parseError: string | null;
  weights: Record<string, number>;
  strengths: Strength[];
  sugTerms: SuggestedTerm[];
  sugCos: SuggestedCompany[];
  facts: remote.ProfileFacts | null;
  profileTermsAdded: Record<string, boolean>;
  profileCosAdded: Record<string, boolean>;
  // Radar agent
  autonomy: Autonomy;
  radarPaused: boolean;
  proposals: Proposal[];
  proposalState: Record<string, 'approved' | 'dismissed'>;
  // Assistant rail
  assistantOpen: boolean;
  chat: ChatMessage[];
  chatBusy: boolean;
  // Auth
  authed: boolean;
  authMode: AuthMode;
  acctName: string;
  acctEmail: string;
}

function createInitialState(connected: boolean): AppState {
  const base = {
    connected,
    view: 'recommend' as ViewKey,
    running: false,
    runSources: [] as RunSource[],
    runDone: false,
    runError: false,
    runSummary: '',
    radarStage: 4,
    expanded: {} as Record<string, boolean>,
    canadaOnly: true,
    hideBelow: false,
    sortBy: 'fit' as const,
    dismissed: {},
    overrides: {},
    watchPaused: {},
    gemDecisions: {},
    parsing: false,
    parseError: null,
    weights: {},
    profileTermsAdded: {},
    profileCosAdded: {},
    autonomy: 'balanced' as Autonomy,
    radarPaused: false,
    proposalState: {},
    assistantOpen: true,
    chatBusy: false,
    authMode: 'signin' as AuthMode,
  };
  if (connected) {
    return {
      ...base,
      boot: 'checking',
      summary: { fetched: 0, kept: 0, phantoms: 0, gems: 0, when: 'never' },
      roles: [],
      gems: [],
      termGroups: [],
      watchlist: [],
      excluded: [],
      sources: [],
      pipeline: {},
      resumeText: '',
      linkedinText: '',
      parsed: false,
      strengths: [],
      sugTerms: [],
      sugCos: [],
      facts: null,
      proposals: [],
      chat: [
        {
          role: 'bot',
          text: "Hi — I'm Radar. Your cockpit is empty so far: paste your résumé in Profile, add a few search terms and companies, then send my scouts out. I'll bring back what fits and propose moves for your approval — I only ever act on a yes.",
          showProposals: true,
        },
      ],
      authed: false,
      acctName: '',
      acctEmail: '',
    };
  }
  return {
    ...base,
    boot: 'ready',
    expanded: { onepass: true },
    summary: { fetched: 31, kept: 23, phantoms: 2, gems: 3, when: '14m ago' },
    roles: [...ROLES],
    gems: [...GEMS],
    termGroups: TERM_GROUPS.map((g) => ({ ...g, terms: [...g.terms] })),
    watchlist: [...WATCHLIST],
    excluded: [],
    sources: [...SOURCES],
    pipeline: { onepass: 'applied', jamf: 'interview', ninja: 'interested' },
    resumeText: RESUME_TEXT,
    linkedinText: '',
    parsed: true,
    strengths: [...STRENGTHS],
    sugTerms: [...SUG_TERMS],
    sugCos: [...SUG_COS],
    facts: { seniority: 'Senior IC / Tech-Lead', location: 'Winnipeg, MB', canadaEligible: true },
    proposals: [...PROPOSALS],
    chat: [
      {
        role: 'bot',
        text: "Hi — I'm Radar. I send scouts across your sources and bring back what fits. I can walk you through your matches, explain any fit score, flag phantoms, or tee up changes for your approval. Where do you want to start?",
      },
      {
        role: 'bot',
        text: 'Heads up: my scouts brought back a few moves for your review. Approve the ones you like — I only ever act on a yes.',
        showProposals: true,
      },
    ],
    authed: true,
    acctName: 'Sr. IT Specialist',
    acctEmail: 'you@icloud.com',
  };
}

export type Action =
  | { type: 'SET_VIEW'; view: ViewKey }
  | { type: 'BOOT_READY'; authed: boolean; name?: string; email?: string }
  | { type: 'HYDRATE'; snapshot: remote.AccountSnapshot }
  | { type: 'RUN_START'; sources: RunSource[] }
  | { type: 'RUN_TICK'; sources: RunSource[]; radarStage: number }
  | { type: 'RUN_DONE'; runSummary: string; summary: SweepSummary; error?: boolean; sources?: RunSource[] }
  | { type: 'SWEEP_APPLIED'; outcome: remote.SweepOutcome }
  | { type: 'TOGGLE_EXPAND'; id: string }
  | { type: 'DISMISS_ROLE'; id: string }
  | { type: 'DISMISS_MANY'; ids: string[] }
  | { type: 'QUEUE_PROPOSAL'; proposal: Proposal }
  | { type: 'SET_SORT'; sortBy: 'fit' | 'new' }
  | { type: 'TOGGLE_CANADA' }
  | { type: 'TOGGLE_BELOW' }
  | { type: 'TOGGLE_OVERRIDE'; id: string }
  | { type: 'ADD_TO_PIPE'; id: string }
  | { type: 'REMOVE_FROM_PIPE'; id: string }
  | { type: 'MOVE_STAGE'; id: string; dir: 1 | -1 }
  | { type: 'ADD_CO'; entry: WatchEntry }
  | { type: 'SET_CO_BOARDS'; name: string; entries: WatchEntry[] }
  | { type: 'REMOVE_CO'; name: string; src?: string }
  | { type: 'RANGE_POPULATED'; termGroups: TermGroup[]; companies: string[] }
  | { type: 'TOGGLE_PAUSE_CO'; name: string }
  | { type: 'MUTE_CO'; name: string }
  | { type: 'UNMUTE_CO'; name: string }
  | { type: 'TOGGLE_SOURCE'; name: string }
  | { type: 'REMOVE_TERM'; group: number; term: string }
  | { type: 'ADD_TERM'; group: number; term: string }
  | { type: 'DECIDE_GEM'; id: string; decision: 'confirmed' | 'dismissed' }
  | { type: 'SET_RESUME'; text: string }
  | { type: 'SET_LINKEDIN'; text: string }
  | { type: 'PARSE_PROFILE' }
  | { type: 'SET_PARSING'; parsing: boolean }
  | { type: 'PROFILE_PARSED'; outcome: remote.ParseOutcome }
  | { type: 'CYCLE_WEIGHT'; key: string; base: number }
  | { type: 'ADD_PROFILE_TERM'; label: string }
  | { type: 'ADD_PROFILE_CO'; name: string }
  | { type: 'SET_AUTONOMY'; autonomy: Autonomy }
  | { type: 'TOGGLE_RADAR_PAUSE' }
  | { type: 'APPROVE_PROPOSAL'; id: string }
  | { type: 'DISMISS_PROPOSAL'; id: string }
  | { type: 'TOGGLE_ASSISTANT' }
  | { type: 'OPEN_ASSISTANT' }
  | { type: 'SEND_CHAT'; text: string }
  | { type: 'CHAT_PUSH'; role: 'bot' | 'user'; text: string; showProposals?: boolean }
  | { type: 'CHAT_APPEND'; text: string }
  | { type: 'CHAT_BUSY'; busy: boolean }
  | { type: 'CHAT_HYDRATE'; messages: ChatMessage[] }
  | { type: 'CHAT_ERROR'; text: string }
  | { type: 'SET_AUTH_MODE'; mode: AuthMode }
  | { type: 'SIGN_IN'; email?: string; name?: string }
  | { type: 'VERIFY'; name?: string; email?: string }
  | { type: 'SIGN_OUT' };

const STAGE_ORDER: PipelineStageKey[] = [
  'new',
  'interested',
  'applied',
  'interview',
  'offer',
  'closed',
];

/** What an approval lets Radar do — the bot's only path to changing state.
 *  Design mode mirrors the prototype's scripted proposals; connected mode
 *  executes the proposal's payload (persistence happens in the provider). */
function applyApproval(state: AppState, id: string): AppState {
  const proposal = state.proposals.find((p) => p.id === id);
  if (proposal?.targetIds?.length) {
    // Bulk action (dismiss-hidden): dismiss exactly the captured set.
    const dismissed = { ...state.dismissed };
    for (const rid of proposal.targetIds) dismissed[rid] = true;
    return { ...state, dismissed };
  }
  if (proposal?.payload?.roleId) {
    // mutePhantom: clear the flag locally; the row update happens provider-side.
    return {
      ...state,
      roles: state.roles.map((r) =>
        r.id === proposal.payload!.roleId ? { ...r, phantom: undefined } : r,
      ),
    };
  }
  switch (id) {
    case 'p_term': {
      const termGroups = state.termGroups.map((g, i) =>
        i === 1 ? { ...g, terms: [...g.terms, 'Workspace Engineer'] } : g,
      );
      return { ...state, termGroups };
    }
    case 'p_watch':
      return { ...state, watchlist: [...state.watchlist, { name: 'Coveo', src: 'RSS' }] };
    case 'p_source': {
      const sources = [...state.sources];
      sources.splice(7, 0, { name: 'Vidyard', note: 'ATS JSON · direct board', tag: 'ACTIVE', on: true });
      return { ...state, sources };
    }
    case 'p_auto':
      return { ...state, autonomy: 'wide' };
    default:
      return state;
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'BOOT_READY':
      return {
        ...state,
        boot: 'ready',
        authed: action.authed,
        acctName: action.name ?? state.acctName,
        acctEmail: action.email ?? state.acctEmail,
      };
    case 'HYDRATE':
      return {
        ...state,
        ...action.snapshot,
        boot: 'ready',
        authed: true,
      };
    case 'RUN_START':
      return {
        ...state,
        running: true,
        view: 'radar',
        runDone: false,
        runError: false,
        runSummary: '',
        runSources: action.sources,
        radarStage: 0,
      };
    case 'RUN_TICK':
      return { ...state, runSources: action.sources, radarStage: action.radarStage };
    case 'RUN_DONE':
      return {
        ...state,
        running: false,
        runDone: true,
        runError: !!action.error,
        radarStage: 4,
        runSummary: action.runSummary,
        summary: action.summary,
        // Connected mode passes explicit per-source rows (with real statuses
        // from staged progress) — use them verbatim. Design mode passes none,
        // so collapse the animated rows to done.
        runSources:
          action.sources ??
          state.runSources.map((s) =>
            s.kind === 'manual' ? { ...s, status: 'manual' } : { ...s, status: 'done' },
          ),
      };
    case 'SWEEP_APPLIED':
      // Decision maps merge local-over-remote: a dismissal or stage move
      // clicked while the sweep was in flight must never be raced away.
      return {
        ...state,
        roles: action.outcome.roles,
        gems: action.outcome.gems,
        proposals: action.outcome.proposals,
        proposalState: { ...action.outcome.proposalState, ...state.proposalState },
        pipeline: { ...action.outcome.pipeline, ...state.pipeline },
        dismissed: { ...action.outcome.dismissed, ...state.dismissed },
        overrides: { ...action.outcome.overrides, ...state.overrides },
        gemDecisions: { ...action.outcome.gemDecisions, ...state.gemDecisions },
      };
    case 'TOGGLE_EXPAND':
      return { ...state, expanded: { ...state.expanded, [action.id]: !state.expanded[action.id] } };
    case 'DISMISS_ROLE':
      return { ...state, dismissed: { ...state.dismissed, [action.id]: true } };
    case 'DISMISS_MANY': {
      const dismissed = { ...state.dismissed };
      for (const id of action.ids) dismissed[id] = true;
      return { ...state, dismissed };
    }
    case 'QUEUE_PROPOSAL':
      return state.proposals.some((p) => p.id === action.proposal.id)
        ? state
        : { ...state, proposals: [action.proposal, ...state.proposals] };
    case 'SET_SORT':
      return { ...state, sortBy: action.sortBy };
    case 'TOGGLE_CANADA':
      return { ...state, canadaOnly: !state.canadaOnly };
    case 'TOGGLE_BELOW':
      return { ...state, hideBelow: !state.hideBelow };
    case 'TOGGLE_OVERRIDE':
      return { ...state, overrides: { ...state.overrides, [action.id]: !state.overrides[action.id] } };
    case 'ADD_TO_PIPE':
      return { ...state, pipeline: { ...state.pipeline, [action.id]: 'interested' } };
    case 'REMOVE_FROM_PIPE': {
      const pipeline = { ...state.pipeline };
      delete pipeline[action.id];
      return { ...state, pipeline };
    }
    case 'MOVE_STAGE': {
      const cur = state.pipeline[action.id] ?? 'new';
      const i = Math.max(0, Math.min(STAGE_ORDER.length - 1, STAGE_ORDER.indexOf(cur) + action.dir));
      return { ...state, pipeline: { ...state.pipeline, [action.id]: STAGE_ORDER[i] } };
    }
    case 'ADD_CO': {
      // One row per company-board pair — a company can live on several ATSs.
      const dupe = state.watchlist.some(
        (w) =>
          w.name.toLowerCase() === action.entry.name.toLowerCase() && w.src === action.entry.src,
      );
      if (dupe) return state;
      return {
        ...state,
        watchlist: [...state.watchlist, action.entry],
        // Invariant: never on the watchlist and excluded at once.
        excluded: state.excluded.filter((n) => n !== action.entry.name),
      };
    }
    case 'SET_CO_BOARDS': {
      // Board resolution replacing a company's placeholder row(s) with one
      // row per ATS board found.
      if (!action.entries.length) return state;
      const rest = state.watchlist.filter(
        (w) => w.name.toLowerCase() !== action.name.toLowerCase(),
      );
      return { ...state, watchlist: [...rest, ...action.entries] };
    }
    case 'RANGE_POPULATED': {
      // Parse → Range pipeline. Non-destructive merge: a fresh range (no
      // terms anywhere) adopts the AI groups wholesale; an in-use range keeps
      // everything and gains new groups/terms, deduped case-insensitively.
      const hasTerms = state.termGroups.some((g) => g.terms.length > 0);
      let termGroups: TermGroup[];
      if (!hasTerms && action.termGroups.length) {
        termGroups = action.termGroups;
      } else {
        termGroups = [...state.termGroups];
        for (const ai of action.termGroups) {
          const existing = termGroups.findIndex(
            (g) => g.name.toLowerCase() === ai.name.toLowerCase(),
          );
          if (existing === -1) {
            termGroups.push(ai);
          } else {
            const have = new Set(termGroups[existing].terms.map((t) => t.toLowerCase()));
            termGroups[existing] = {
              ...termGroups[existing],
              terms: [
                ...termGroups[existing].terms,
                ...ai.terms.filter((t) => !have.has(t.toLowerCase())),
              ],
            };
          }
        }
      }
      const watchNames = new Set(state.watchlist.map((w) => w.name.toLowerCase()));
      const excludedSet = new Set(state.excluded.map((n) => n.toLowerCase()));
      const additions = action.companies
        .filter((n) => !watchNames.has(n.toLowerCase()) && !excludedSet.has(n.toLowerCase()))
        // Aggregate-feed tag until the board resolver upgrades the provider.
        .map((name): WatchEntry => ({ name, src: 'RSS' }));
      return { ...state, termGroups, watchlist: [...state.watchlist, ...additions] };
    }
    case 'TOGGLE_PAUSE_CO':
      return {
        ...state,
        watchPaused: { ...state.watchPaused, [action.name]: !state.watchPaused[action.name] },
      };
    case 'REMOVE_CO':
      // With a src, remove just that board row; without, the whole company.
      return {
        ...state,
        watchlist: state.watchlist.filter(
          (w) => w.name !== action.name || (action.src !== undefined && w.src !== action.src),
        ),
      };
    case 'MUTE_CO': {
      // Invariant (ARCHITECTURE.md §2): never on the watchlist and excluded at once.
      const watchPaused = { ...state.watchPaused };
      delete watchPaused[action.name];
      return {
        ...state,
        excluded: state.excluded.includes(action.name) ? state.excluded : [...state.excluded, action.name],
        watchPaused,
      };
    }
    case 'UNMUTE_CO': {
      const onWatchlist = state.watchlist.some((w) => w.name === action.name);
      return {
        ...state,
        excluded: state.excluded.filter((n) => n !== action.name),
        // Un-muting returns a watchlisted company as paused, not live.
        watchPaused: onWatchlist ? { ...state.watchPaused, [action.name]: true } : state.watchPaused,
      };
    }
    case 'TOGGLE_SOURCE':
      return {
        ...state,
        sources: state.sources.map((s) =>
          s.name === action.name && s.tag !== 'MANUAL'
            ? { ...s, on: !s.on, tag: s.on ? 'OFF' : 'ACTIVE' }
            : s,
        ),
      };
    case 'REMOVE_TERM':
      return {
        ...state,
        termGroups: state.termGroups.map((g, i) =>
          i === action.group ? { ...g, terms: g.terms.filter((t) => t !== action.term) } : g,
        ),
      };
    case 'ADD_TERM': {
      const term = action.term.trim();
      if (!term) return state;
      return {
        ...state,
        termGroups: state.termGroups.map((g, i) =>
          i === action.group && !g.terms.includes(term) ? { ...g, terms: [...g.terms, term] } : g,
        ),
      };
    }
    case 'DECIDE_GEM':
      return { ...state, gemDecisions: { ...state.gemDecisions, [action.id]: action.decision } };
    case 'SET_RESUME':
      return { ...state, resumeText: action.text, parsed: false };
    case 'SET_LINKEDIN':
      return { ...state, linkedinText: action.text };
    case 'PARSE_PROFILE':
      // Design mode: the seed is "the parse". Connected mode goes through
      // api.parseProfile → PROFILE_PARSED instead.
      return { ...state, parsed: true };
    case 'SET_PARSING':
      return { ...state, parsing: action.parsing };
    case 'PROFILE_PARSED': {
      // Connected mode auto-watches the suggested companies (the parse →
      // Range pipeline), so their chips render as already added.
      const profileCosAdded = { ...state.profileCosAdded };
      if (state.connected) for (const c of action.outcome.sugCos) profileCosAdded[c.name] = true;
      return {
        ...state,
        parsed: true,
        parsing: false,
        parseError: action.outcome.aiError ?? null,
        strengths: action.outcome.strengths,
        sugTerms: action.outcome.sugTerms,
        sugCos: action.outcome.sugCos,
        facts: action.outcome.facts ?? state.facts,
        profileCosAdded,
      };
    }
    case 'CYCLE_WEIGHT': {
      const cur = state.weights[action.key] ?? action.base;
      return { ...state, weights: { ...state.weights, [action.key]: (cur % 3) + 1 } };
    }
    case 'ADD_PROFILE_TERM': {
      const next = {
        ...state,
        profileTermsAdded: { ...state.profileTermsAdded, [action.label]: true },
      };
      if (!state.connected) return next;
      // Connected: actually add the term to the first group.
      return {
        ...next,
        termGroups: state.termGroups.map((g, i) =>
          i === 0 && !g.terms.includes(action.label) ? { ...g, terms: [...g.terms, action.label] } : g,
        ),
      };
    }
    case 'ADD_PROFILE_CO': {
      const next = { ...state, profileCosAdded: { ...state.profileCosAdded, [action.name]: true } };
      if (!state.connected) return next;
      if (state.watchlist.some((w) => w.name === action.name)) return next;
      return { ...next, watchlist: [...state.watchlist, { name: action.name, src: 'Greenhouse' }] };
    }
    case 'SET_AUTONOMY':
      return { ...state, autonomy: action.autonomy };
    case 'TOGGLE_RADAR_PAUSE':
      return { ...state, radarPaused: !state.radarPaused };
    case 'APPROVE_PROPOSAL':
      return {
        ...applyApproval(state, action.id),
        proposalState: { ...state.proposalState, [action.id]: 'approved' },
      };
    case 'DISMISS_PROPOSAL':
      return { ...state, proposalState: { ...state.proposalState, [action.id]: 'dismissed' } };
    case 'TOGGLE_ASSISTANT':
      return { ...state, assistantOpen: !state.assistantOpen };
    case 'OPEN_ASSISTANT':
      return { ...state, assistantOpen: true };
    case 'SEND_CHAT': {
      // Design mode only — connected chat streams via api.sendChat.
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state,
        chat: [...state.chat, { role: 'user', text }, { role: 'bot', text: botReply(text) }],
      };
    }
    case 'CHAT_PUSH':
      return {
        ...state,
        chat: [
          ...state.chat,
          { role: action.role, text: action.text, showProposals: action.showProposals },
        ],
      };
    case 'CHAT_APPEND': {
      const chat = [...state.chat];
      const last = chat[chat.length - 1];
      if (last?.role === 'bot') chat[chat.length - 1] = { ...last, text: (last.text ?? '') + action.text };
      return { ...state, chat };
    }
    case 'CHAT_BUSY':
      return { ...state, chatBusy: action.busy };
    case 'CHAT_HYDRATE': {
      if (!action.messages.length) return state;
      // Re-attach the approval queue to the last bot message so the rail's
      // proposal cards survive history hydration.
      const pending = state.proposals.some((p) => !state.proposalState[p.id]);
      const chat = [...action.messages];
      for (let i = chat.length - 1; i >= 0 && pending; i--) {
        if (chat[i].role === 'bot') {
          chat[i] = { ...chat[i], showProposals: true };
          break;
        }
      }
      return { ...state, chat };
    }
    case 'CHAT_ERROR': {
      const chat = [...state.chat];
      const last = chat[chat.length - 1];
      if (last?.role === 'bot' && !last.text) {
        chat[chat.length - 1] = { ...last, text: action.text, error: true };
      } else {
        chat.push({ role: 'bot', text: action.text, error: true });
      }
      return { ...state, chat, chatBusy: false };
    }
    case 'SET_AUTH_MODE':
      return { ...state, authMode: action.mode };
    case 'SIGN_IN':
      return {
        ...state,
        authed: true,
        acctEmail: action.email || state.acctEmail,
        acctName: action.name || state.acctName,
      };
    case 'VERIFY':
      return {
        ...state,
        authed: true,
        acctName: action.name || state.acctName,
        acctEmail: action.email || state.acctEmail,
      };
    case 'SIGN_OUT':
      return {
        ...createInitialState(state.connected),
        boot: 'ready',
        authed: false,
        authMode: 'signin',
      };
  }
}

// Actions whose end state must be mirrored into the owner's SearchConfig row.
const SEARCH_SYNC = new Set<Action['type']>([
  'ADD_TERM',
  'REMOVE_TERM',
  'ADD_CO',
  'SET_CO_BOARDS',
  'RANGE_POPULATED',
  'TOGGLE_PAUSE_CO',
  'REMOVE_CO',
  'MUTE_CO',
  'UNMUTE_CO',
  'TOGGLE_SOURCE',
  'SET_AUTONOMY',
  'ADD_PROFILE_CO',
  'ADD_PROFILE_TERM',
  'APPROVE_PROPOSAL',
]);

// Actions whose end state must be mirrored into the owner's Profile row.
const PROFILE_SYNC = new Set<Action['type']>([
  'SET_RESUME',
  'SET_LINKEDIN',
  'CYCLE_WEIGHT',
  'ADD_PROFILE_TERM',
  'PROFILE_PARSED',
]);

interface Api {
  /** Probe ATS boards for a company's provider + slug (connected mode). */
  resolveCompany: (name: string) => Promise<WatchEntry[]>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  confirm: (name: string, email: string, code: string, password: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  startReset: (email: string) => Promise<void>;
  confirmReset: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  parseProfile: () => Promise<void>;
  sendChat: (text: string) => void;
  /** Bulk-dismiss every role the active filters hide (button on Roles).
   *  Returns the count dismissed. */
  dismissHidden: () => number;
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  /** Run a sweep — the design-mode animation, or the real Scout Lambda. */
  startRun: () => void;
  api: Api;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, isConnected, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const runningRef = useRef(false);
  const syncTimers = useRef<{ search?: number; profile?: number }>({});

  // Persistence wrapper: reduce first, then mirror the touched aggregate to
  // Amplify Data (debounced for the config/profile aggregates, immediate for
  // per-row changes). Design mode skips all of it.
  const dispatch = useCallback((action: Action) => {
    rawDispatch(action);
    if (!isConnected || !stateRef.current.authed) return;
    // Let the reducer commit before reading the post-action state.
    queueMicrotask(() => {
      const s = stateRef.current;
      try {
        if (SEARCH_SYNC.has(action.type)) {
          window.clearTimeout(syncTimers.current.search);
          syncTimers.current.search = window.setTimeout(() => {
            remote.saveSearchConfig(stateRef.current).catch((e) => console.warn('search sync', e));
          }, 800);
        }
        if (PROFILE_SYNC.has(action.type)) {
          window.clearTimeout(syncTimers.current.profile);
          syncTimers.current.profile = window.setTimeout(() => {
            remote.saveProfile(stateRef.current).catch((e) => console.warn('profile sync', e));
          }, 800);
        }
        switch (action.type) {
          case 'ADD_TO_PIPE':
            void remote.saveRolePatch(action.id, { pipelineStage: 'interested' });
            break;
          case 'REMOVE_FROM_PIPE':
            void remote.saveRolePatch(action.id, { pipelineStage: 'none' });
            break;
          case 'MOVE_STAGE':
            void remote.saveRolePatch(action.id, { pipelineStage: s.pipeline[action.id] ?? 'new' });
            break;
          case 'DISMISS_ROLE':
            void remote.saveRolePatch(action.id, { dismissed: true });
            break;
          case 'DISMISS_MANY':
            void remote.dismissRolesRemote(action.ids);
            break;
          case 'TOGGLE_OVERRIDE':
            void remote.saveRolePatch(action.id, { eligibilityOverridden: !!s.overrides[action.id] });
            break;
          case 'DECIDE_GEM':
            void remote.saveRolePatch(action.id, { gemDecision: action.decision });
            break;
          case 'APPROVE_PROPOSAL': {
            const p = s.proposals.find((x) => x.id === action.id);
            if (p?.recordId) void remote.saveProposalStatus(p.recordId, 'approved', p.ok);
            if (p?.payload?.roleId) void remote.saveRolePatch(p.payload.roleId, { phantomMuted: true });
            if (p?.targetIds?.length) void remote.dismissRolesRemote(p.targetIds);
            break;
          }
          case 'DISMISS_PROPOSAL': {
            const p = s.proposals.find((x) => x.id === action.id);
            if (p?.recordId) void remote.saveProposalStatus(p.recordId, 'dismissed');
            break;
          }
          default:
            break;
        }
      } catch (e) {
        console.warn('persist', e);
      }
    });
  }, []);

  // Resume the persisted Radar conversation (fire-and-forget — chat falls
  // back to the greeting if history can't load; never blocks hydration).
  const hydrateChat = useCallback(() => {
    remote
      .loadChatHistory()
      .then((messages) => {
        if (messages.length) rawDispatch({ type: 'CHAT_HYDRATE', messages });
      })
      .catch((e) => console.warn('chat history', e));
  }, []);

  // Connected boot: restore the Cognito session, then hydrate the account
  // (creating the empty Profile + default SearchConfig on first sign-in).
  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    (async () => {
      const session = await auth.checkSession();
      if (cancelled) return;
      if (!session.authed) {
        rawDispatch({ type: 'BOOT_READY', authed: false });
        return;
      }
      rawDispatch({
        type: 'BOOT_READY',
        authed: true,
        name: session.name ?? session.email?.split('@')[0],
        email: session.email,
      });
      try {
        const snapshot = await remote.loadAccount();
        if (!cancelled) {
          rawDispatch({ type: 'HYDRATE', snapshot });
          hydrateChat();
        }
      } catch (e) {
        console.warn('hydrate', e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateAfterAuth = useCallback(
    async (name?: string, email?: string) => {
      rawDispatch({ type: 'SIGN_IN', name, email });
      try {
        const snapshot = await remote.loadAccount();
        rawDispatch({ type: 'HYDRATE', snapshot });
        hydrateChat();
      } catch (e) {
        console.warn('hydrate', e);
      }
    },
    [hydrateChat],
  );

  const startRun = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    const s = stateRef.current;

    if (!isConnected) {
      // Design mode: the prototype's scripted sweep animation.
      let sources: RunSource[] = RUN_SRC.map((x) => ({ ...x, status: 'pending' }));
      rawDispatch({ type: 'RUN_START', sources });
      const total = sources.length;
      let i = 0;
      const step = () => {
        sources = sources.map((x) => ({ ...x }));
        if (i > 0) sources[i - 1].status = sources[i - 1].kind === 'manual' ? 'manual' : 'done';
        if (i < sources.length) {
          sources[i].status = sources[i].kind === 'manual' ? 'manual' : 'scanning';
          rawDispatch({ type: 'RUN_TICK', sources, radarStage: Math.min(3, Math.floor((i / total) * 4)) });
          i++;
          setTimeout(step, 480 + Math.random() * 280);
        } else {
          runningRef.current = false;
          rawDispatch({
            type: 'RUN_DONE',
            runSummary:
              'Fetched 31 roles → deduped to 23 by stable id → 2 phantoms flagged → 3 hidden gems surfaced → 4 new proposals queued for your review.',
            summary: { fetched: 31, kept: 23, phantoms: 2, gems: 3, when: 'just now' },
          });
        }
      };
      setTimeout(step, 350);
      return;
    }

    // Connected: the real Scout Lambda, staged one source per call (fanning
    // every source into one 30s call is what timed out). Each row lights up
    // for real as its call returns — no fixed timer.
    const termCount = Math.min(
      remote.MAX_SWEEP_TERMS,
      s.termGroups.reduce((n, g) => n + g.terms.length, 0),
    );
    let sources: RunSource[] = s.sources
      .filter((x) => x.on && remote.SOURCE_ADAPTER_IDS[x.name])
      .map((x): RunSource => {
        const id = remote.SOURCE_ADAPTER_IDS[x.name];
        if (remote.AGGREGATE_ADAPTER_IDS.has(id)) {
          return {
            name: remote.ADAPTER_DISPLAY[id],
            detail: `Canadian aggregate feed · ${termCount} terms`,
            count: '…',
            kind: 'auto',
            status: 'pending',
          };
        }
        const n = s.watchlist.filter((w) => w.src === x.name && !s.watchPaused[w.name]).length;
        return {
          name: remote.ADAPTER_DISPLAY[id],
          detail: `ATS JSON · ${n} watchlist compan${n === 1 ? 'y' : 'ies'}`,
          count: '…',
          kind: 'auto',
          status: 'pending',
        };
      });
    rawDispatch({ type: 'RUN_START', sources });

    let doneCount = 0;
    const total = sources.length || 1;
    const onProgress: remote.SweepProgress = (id, status, count) => {
      const name = remote.ADAPTER_DISPLAY[id];
      sources = sources.map((src) =>
        src.name === name
          ? {
              ...src,
              status: status === 'scanning' ? 'scanning' : status === 'error' ? 'error' : 'done',
              count:
                status === 'done' ? `${count ?? 0} role${count === 1 ? '' : 's'}` : src.count,
            }
          : src,
      );
      if (status === 'done' || status === 'error') doneCount++;
      rawDispatch({
        type: 'RUN_TICK',
        sources,
        radarStage: Math.min(3, Math.round((doneCount / total) * 4)),
      });
    };

    (async () => {
      try {
        const outcome = await remote.runSweepRemote(s, s.resumeText, onProgress);
        rawDispatch({ type: 'SWEEP_APPLIED', outcome });
        rawDispatch({
          type: 'RUN_DONE',
          // Honest summary: net-new roles/gems that cleared the same filters
          // the sidebar uses — not the raw scan funnel (which counts matches
          // the Canada filter and prior decisions correctly keep hidden).
          runSummary: sweepSummaryLine(s, outcome),
          summary: outcome.summary,
          sources,
        });
      } catch (e) {
        rawDispatch({
          type: 'RUN_DONE',
          runSummary: `Sweep failed: ${e instanceof Error ? e.message : String(e)}. Check the sweep Lambda logs and try again.`,
          summary: stateRef.current.summary,
          error: true,
        });
      } finally {
        runningRef.current = false;
      }
    })();
  }, []);

  const api = useMemo<Api>(
    () => ({
      async resolveCompany(name) {
        if (!isConnected) return [];
        try {
          return await remote.resolveCompanyRemote(name);
        } catch {
          return [];
        }
      },
      async signIn(email, password) {
        await auth.doSignIn(email, password);
        await hydrateAfterAuth(email.split('@')[0], email);
      },
      async signUp(name, email, password) {
        await auth.doSignUp(name, email, password);
      },
      async confirm(name, email, code, password) {
        await auth.doConfirm(email, code);
        if (isConnected) await auth.doSignIn(email, password);
        await hydrateAfterAuth(name || email.split('@')[0], email);
      },
      async resendCode(email) {
        await auth.doResendCode(email);
      },
      async startReset(email) {
        await auth.doStartReset(email);
      },
      async confirmReset(email, code, newPassword) {
        await auth.doConfirmReset(email, code, newPassword);
      },
      async signOut() {
        await auth.doSignOut();
        remote.resetAccountCache();
        rawDispatch({ type: 'SIGN_OUT' });
      },
      async parseProfile() {
        const s = stateRef.current;
        if (!isConnected) {
          rawDispatch({ type: 'PARSE_PROFILE' });
          return;
        }
        rawDispatch({ type: 'SET_PARSING', parsing: true });
        try {
          const outcome = await remote.parseProfileRemote(s.resumeText, s.linkedinText);
          rawDispatch({ type: 'PROFILE_PARSED', outcome });
          remote.saveProfile({ ...stateRef.current, ...outcome }).catch(() => undefined);

          // Parse → Range pipeline: populate the scouts' range with the AI
          // term groups and auto-watch suggested companies (non-destructive
          // merge; persisted via the SearchConfig sync).
          const before = new Set(stateRef.current.watchlist.map((w) => w.name.toLowerCase()));
          dispatch({
            type: 'RANGE_POPULATED',
            termGroups: outcome.termGroups,
            companies: outcome.sugCos.map((c) => c.name),
          });
          // Resolve each newly watched company's ATS boards in the
          // background; the placeholder row becomes one row per board found.
          for (const c of outcome.sugCos) {
            if (before.has(c.name.toLowerCase())) continue;
            remote
              .resolveCompanyRemote(c.name)
              .then((entries) => {
                if (entries.length) dispatch({ type: 'SET_CO_BOARDS', name: c.name, entries });
              })
              .catch(() => undefined);
          }
        } catch (e) {
          console.warn('parse', e);
          rawDispatch({ type: 'SET_PARSING', parsing: false });
        }
      },
      sendChat(text) {
        const t = text.trim();
        if (!t) return;

        // "Dismiss hidden / non-CA / below-level roles" — recognized from the
        // owner's own words (deterministic, no model needed) and routed through
        // the approval queue: Radar proposes, the owner approves. Works in both
        // modes and even if Bedrock chat is down.
        const wantsTidy =
          /\bdismiss\b/i.test(t) &&
          /\b(hidden|non[-\s]?canad|out[-\s]?of[-\s]?range|below[-\s]?level|ineligible|us[-\s]?only)\b/i.test(t);
        if (wantsTidy) {
          rawDispatch({ type: 'CHAT_PUSH', role: 'user', text: t });
          const hidden = hiddenRoles(stateRef.current);
          if (!hidden.length) {
            rawDispatch({
              type: 'CHAT_PUSH',
              role: 'bot',
              text: 'Nothing hidden to dismiss — every role in your list already clears your Canada and level filters.',
            });
            return;
          }
          const n = hidden.length;
          dispatch({
            type: 'QUEUE_PROPOSAL',
            proposal: {
              id: `dismiss-hidden-${Date.now()}`,
              kind: 'TIDY ROLES',
              tone: 'warn',
              title: `Dismiss ${n} hidden role${n === 1 ? '' : 's'}`,
              rationale:
                'Roles your Canada-eligible and below-level filters currently hide — non-Canada or below your level. Approving clears them from your list (kept in your data, not deleted).',
              ok: `Dismissed ${n} hidden role${n === 1 ? '' : 's'}.`,
              targetIds: hidden.map((r) => r.id),
            },
          });
          rawDispatch({
            type: 'CHAT_PUSH',
            role: 'bot',
            text: `${n} role${n === 1 ? ' is' : 's are'} hidden by your filters (non-Canada or below level). I only act on your OK, so I've queued the dismissal — approve it below.`,
            showProposals: true,
          });
          return;
        }

        if (!isConnected) {
          dispatch({ type: 'SEND_CHAT', text: t });
          return;
        }
        // Grounding context rides with every message — built before the
        // optimistic pushes so it reflects the state the user was looking at.
        const aiContext = buildChatContext(stateRef.current);
        rawDispatch({ type: 'CHAT_PUSH', role: 'user', text: t });
        rawDispatch({ type: 'CHAT_PUSH', role: 'bot', text: '' });
        rawDispatch({ type: 'CHAT_BUSY', busy: true });
        const fail = (message: string) =>
          rawDispatch({
            type: 'CHAT_ERROR',
            text: `⚠ My reasoning model is unreachable — ${message}. If this mentions access, enable Bedrock model access for the configured Claude models in the app's region, then try again.`,
          });
        remote
          .sendChatRemote(t, aiContext, {
            onDelta: (delta) => rawDispatch({ type: 'CHAT_APPEND', text: delta }),
            onDone: () => rawDispatch({ type: 'CHAT_BUSY', busy: false }),
            onError: fail,
          })
          .catch((e) => fail(e instanceof Error ? e.message : String(e)));
      },
      dismissHidden() {
        const ids = hiddenRoles(stateRef.current).map((r) => r.id);
        if (ids.length) dispatch({ type: 'DISMISS_MANY', ids });
        return ids.length;
      },
    }),
    [dispatch, hydrateAfterAuth],
  );

  const store = useMemo(() => ({ state, dispatch, startRun, api }), [state, dispatch, startRun, api]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
