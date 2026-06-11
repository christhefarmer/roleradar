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
  | { type: 'SET_SORT'; sortBy: 'fit' | 'new' }
  | { type: 'TOGGLE_CANADA' }
  | { type: 'TOGGLE_BELOW' }
  | { type: 'TOGGLE_OVERRIDE'; id: string }
  | { type: 'ADD_TO_PIPE'; id: string }
  | { type: 'REMOVE_FROM_PIPE'; id: string }
  | { type: 'MOVE_STAGE'; id: string; dir: 1 | -1 }
  | { type: 'ADD_CO'; entry: WatchEntry }
  | { type: 'TOGGLE_PAUSE_CO'; name: string }
  | { type: 'REMOVE_CO'; name: string }
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
  | { type: 'CHAT_PUSH'; role: 'bot' | 'user'; text: string }
  | { type: 'CHAT_APPEND'; text: string }
  | { type: 'CHAT_BUSY'; busy: boolean }
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
        runSources: (action.sources ?? state.runSources).map((s) =>
          s.kind === 'manual' ? { ...s, status: 'manual' } : { ...s, status: 'done' },
        ),
      };
    case 'SWEEP_APPLIED':
      return {
        ...state,
        roles: action.outcome.roles,
        gems: action.outcome.gems,
        proposals: action.outcome.proposals,
        proposalState: action.outcome.proposalState,
      };
    case 'TOGGLE_EXPAND':
      return { ...state, expanded: { ...state.expanded, [action.id]: !state.expanded[action.id] } };
    case 'DISMISS_ROLE':
      return { ...state, dismissed: { ...state.dismissed, [action.id]: true } };
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
      if (state.watchlist.some((w) => w.name.toLowerCase() === action.entry.name.toLowerCase()))
        return state;
      return {
        ...state,
        watchlist: [...state.watchlist, action.entry],
        // Invariant: never on the watchlist and excluded at once.
        excluded: state.excluded.filter((n) => n !== action.entry.name),
      };
    }
    case 'TOGGLE_PAUSE_CO':
      return {
        ...state,
        watchPaused: { ...state.watchPaused, [action.name]: !state.watchPaused[action.name] },
      };
    case 'REMOVE_CO':
      return { ...state, watchlist: state.watchlist.filter((w) => w.name !== action.name) };
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
    case 'PROFILE_PARSED':
      return {
        ...state,
        parsed: true,
        parsing: false,
        strengths: action.outcome.strengths,
        sugTerms: action.outcome.sugTerms,
        sugCos: action.outcome.sugCos,
        facts: action.outcome.facts ?? state.facts,
      };
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
      return { ...state, chat: [...state.chat, { role: action.role, text: action.text }] };
    case 'CHAT_APPEND': {
      const chat = [...state.chat];
      const last = chat[chat.length - 1];
      if (last?.role === 'bot') chat[chat.length - 1] = { ...last, text: (last.text ?? '') + action.text };
      return { ...state, chat };
    }
    case 'CHAT_BUSY':
      return { ...state, chatBusy: action.busy };
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  confirm: (name: string, email: string, code: string, password: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  startReset: (email: string) => Promise<void>;
  confirmReset: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  parseProfile: () => Promise<void>;
  sendChat: (text: string) => void;
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
        if (!cancelled) rawDispatch({ type: 'HYDRATE', snapshot });
      } catch (e) {
        console.warn('hydrate', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hydrateAfterAuth = useCallback(async (name?: string, email?: string) => {
    rawDispatch({ type: 'SIGN_IN', name, email });
    try {
      const snapshot = await remote.loadAccount();
      rawDispatch({ type: 'HYDRATE', snapshot });
    } catch (e) {
      console.warn('hydrate', e);
    }
  }, []);

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

    // Connected: the real Scout Lambda via the startSweep mutation. The
    // per-source list animates while the call is in flight; the v2 upgrade
    // replaces this with live progress over an AppSync subscription.
    const termCount = s.termGroups.reduce((n, g) => n + g.terms.length, 0);
    let sources: RunSource[] = s.sources
      .filter((x) => x.on && remote.SOURCE_ADAPTER_IDS[x.name])
      .map((x): RunSource => {
        const id = remote.SOURCE_ADAPTER_IDS[x.name];
        if (id === 'eluta') {
          return {
            name: remote.ADAPTER_DISPLAY[id],
            detail: `Sanctioned Canadian aggregate · ${termCount} terms`,
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
    sources.push({
      name: 'LinkedIn',
      detail: 'Manual alert inbox — no automated pull',
      count: 'manual',
      kind: 'manual',
      status: 'manual',
    });
    rawDispatch({ type: 'RUN_START', sources });
    let tick = 0;
    const ticker = window.setInterval(() => {
      tick++;
      sources = sources.map((x, i) =>
        x.kind === 'manual' ? x : { ...x, status: i < tick ? 'scanning' : x.status },
      );
      rawDispatch({ type: 'RUN_TICK', sources, radarStage: Math.min(3, tick) });
    }, 900);

    (async () => {
      try {
        const outcome = await remote.runSweepRemote(s, s.resumeText);
        rawDispatch({ type: 'SWEEP_APPLIED', outcome });
        const finalSources = sources.map((src) => {
          const entry = outcome.perSource.find((p) => remote.ADAPTER_DISPLAY[p.id] === src.name);
          return entry ? { ...src, count: `${entry.count} role${entry.count === 1 ? '' : 's'}` } : src;
        });
        rawDispatch({
          type: 'RUN_DONE',
          runSummary: outcome.runSummary,
          summary: outcome.summary,
          sources: finalSources,
        });
      } catch (e) {
        rawDispatch({
          type: 'RUN_DONE',
          runSummary: `Sweep failed: ${e instanceof Error ? e.message : String(e)}. Check that the backend is deployed and try again.`,
          summary: stateRef.current.summary,
          error: true,
        });
      } finally {
        window.clearInterval(ticker);
        runningRef.current = false;
      }
    })();
  }, []);

  const api = useMemo<Api>(
    () => ({
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
        } catch (e) {
          console.warn('parse', e);
          rawDispatch({ type: 'SET_PARSING', parsing: false });
        }
      },
      sendChat(text) {
        const t = text.trim();
        if (!t) return;
        if (!isConnected) {
          dispatch({ type: 'SEND_CHAT', text: t });
          return;
        }
        rawDispatch({ type: 'CHAT_PUSH', role: 'user', text: t });
        rawDispatch({ type: 'CHAT_PUSH', role: 'bot', text: '' });
        rawDispatch({ type: 'CHAT_BUSY', busy: true });
        remote
          .sendChatRemote(
            t,
            (delta) => rawDispatch({ type: 'CHAT_APPEND', text: delta }),
            () => rawDispatch({ type: 'CHAT_BUSY', busy: false }),
          )
          .catch(() => {
            rawDispatch({
              type: 'CHAT_APPEND',
              text: '— I could not reach my reasoning model. Check that Bedrock model access is enabled for the configured Claude model, then try again.',
            });
            rawDispatch({ type: 'CHAT_BUSY', busy: false });
          });
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
