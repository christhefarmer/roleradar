// Global app state. UI state + per-account data live here behind one store so
// the Amplify Data wiring (generateClient<Schema>() + AppSync subscriptions)
// can replace the seed/reducer internals without touching the views.
//
// Product invariant carried through every action here: Radar proposes, the
// owner approves. The only mutations that "act for" the bot are the ones
// behind approveProposal.

/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  AuthMode,
  Autonomy,
  ChatMessage,
  PipelineStageKey,
  Proposal,
  RunSource,
  SourceDef,
  SweepSummary,
  TermGroup,
  ViewKey,
  WatchEntry,
} from '../domain/types';
import {
  PROPOSALS,
  RESUME_TEXT,
  RUN_SRC,
  SOURCES,
  TERM_GROUPS,
  WATCHLIST,
} from '../data/seed';
import { botReply } from '../data/botReplies';

export interface AppState {
  view: ViewKey;
  // Sweep (the agentic run) — in production this mirrors the async sweep
  // Lambda job, with progress arriving over an AppSync subscription.
  running: boolean;
  runSources: RunSource[];
  runDone: boolean;
  runSummary: string;
  radarStage: number;
  summary: SweepSummary;
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
  weights: Record<string, number>;
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
  // Auth (mock — production swaps in Amplify Auth / Cognito)
  authed: boolean;
  authMode: AuthMode;
  acctName: string;
  acctEmail: string;
}

const initialState: AppState = {
  view: 'recommend',
  running: false,
  runSources: [],
  runDone: false,
  runSummary: '',
  radarStage: 4,
  summary: { fetched: 31, kept: 23, phantoms: 2, gems: 3, when: '14m ago' },
  expanded: { onepass: true },
  canadaOnly: true,
  hideBelow: false,
  sortBy: 'fit',
  dismissed: {},
  overrides: {},
  termGroups: TERM_GROUPS.map((g) => ({ ...g, terms: [...g.terms] })),
  watchlist: [...WATCHLIST],
  watchPaused: {},
  excluded: [],
  sources: [...SOURCES],
  gemDecisions: {},
  pipeline: { onepass: 'applied', jamf: 'interview', ninja: 'interested' },
  resumeText: RESUME_TEXT,
  linkedinText: '',
  parsed: true,
  weights: {},
  profileTermsAdded: {},
  profileCosAdded: {},
  autonomy: 'balanced',
  radarPaused: false,
  proposals: [...PROPOSALS],
  proposalState: {},
  assistantOpen: true,
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
  authMode: 'signin',
  acctName: 'Sr. IT Specialist',
  acctEmail: 'you@icloud.com',
};

type Action =
  | { type: 'SET_VIEW'; view: ViewKey }
  | { type: 'RUN_START'; sources: RunSource[] }
  | { type: 'RUN_TICK'; sources: RunSource[]; radarStage: number }
  | { type: 'RUN_DONE'; runSummary: string; summary: SweepSummary }
  | { type: 'TOGGLE_EXPAND'; id: string }
  | { type: 'DISMISS_ROLE'; id: string }
  | { type: 'SET_SORT'; sortBy: 'fit' | 'new' }
  | { type: 'TOGGLE_CANADA' }
  | { type: 'TOGGLE_BELOW' }
  | { type: 'TOGGLE_OVERRIDE'; id: string }
  | { type: 'ADD_TO_PIPE'; id: string }
  | { type: 'REMOVE_FROM_PIPE'; id: string }
  | { type: 'MOVE_STAGE'; id: string; dir: 1 | -1 }
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
  | { type: 'SET_AUTH_MODE'; mode: AuthMode }
  | { type: 'SIGN_IN'; email?: string }
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
 *  Production: these become the approval-gated write tools on the AI
 *  conversation route (addSearchTerm / watchCompany / enableSource / …). */
function applyApproval(state: AppState, id: string): AppState {
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
    case 'RUN_START':
      return {
        ...state,
        running: true,
        view: 'radar',
        runDone: false,
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
        radarStage: 4,
        runSummary: action.runSummary,
        summary: action.summary,
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
      // Production: server-side heuristic parse (Lambda) → strengths/terms/companies.
      return { ...state, parsed: true };
    case 'CYCLE_WEIGHT': {
      const cur = state.weights[action.key] ?? action.base;
      return { ...state, weights: { ...state.weights, [action.key]: (cur % 3) + 1 } };
    }
    case 'ADD_PROFILE_TERM':
      return { ...state, profileTermsAdded: { ...state.profileTermsAdded, [action.label]: true } };
    case 'ADD_PROFILE_CO':
      return { ...state, profileCosAdded: { ...state.profileCosAdded, [action.name]: true } };
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
      const text = action.text.trim();
      if (!text) return state;
      return {
        ...state,
        chat: [...state.chat, { role: 'user', text }, { role: 'bot', text: botReply(text) }],
      };
    }
    case 'SET_AUTH_MODE':
      return { ...state, authMode: action.mode };
    case 'SIGN_IN':
      return { ...state, authed: true, acctEmail: action.email || state.acctEmail };
    case 'VERIFY':
      return {
        ...state,
        authed: true,
        acctName: action.name || state.acctName,
        acctEmail: action.email || state.acctEmail,
      };
    case 'SIGN_OUT':
      return { ...state, authed: false, authMode: 'signin' };
  }
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  /** Run a sweep. Mock drives timers; production starts the sweep Lambda and
   *  subscribes to its progress (ARCHITECTURE.md §2 — not a fixed timer). */
  startRun: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const runningRef = useRef(false);

  const startRun = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    let sources: RunSource[] = RUN_SRC.map((s) => ({ ...s, status: 'pending' }));
    dispatch({ type: 'RUN_START', sources });
    const total = sources.length;
    let i = 0;
    const step = () => {
      sources = sources.map((x) => ({ ...x }));
      if (i > 0) sources[i - 1].status = sources[i - 1].kind === 'manual' ? 'manual' : 'done';
      if (i < sources.length) {
        sources[i].status = sources[i].kind === 'manual' ? 'manual' : 'scanning';
        dispatch({ type: 'RUN_TICK', sources, radarStage: Math.min(3, Math.floor((i / total) * 4)) });
        i++;
        setTimeout(step, 480 + Math.random() * 280);
      } else {
        runningRef.current = false;
        dispatch({
          type: 'RUN_DONE',
          runSummary:
            'Fetched 31 roles → deduped to 23 by stable id → 2 phantoms flagged → 3 hidden gems surfaced → 4 new proposals queued for your review.',
          summary: { fetched: 31, kept: 23, phantoms: 2, gems: 3, when: 'just now' },
        });
      }
    };
    setTimeout(step, 350);
  }, []);

  const store = useMemo(() => ({ state, dispatch, startRun }), [state, startRun]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
