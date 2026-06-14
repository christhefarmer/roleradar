// Search & watchlist (single column, ~660px): grouped weighted search-term
// cards (each with its own add-term input), the company watchlist (ATS tag,
// pause/resume, remove), excluded companies (rust, un-mute), active sources.

import { Fragment, useState } from 'react';
import type { WatchEntry } from '../domain/types';
import { normalizeSlug, resolveCareersUrl } from '../lib/ats';
import { useStore, type BoardCheckStatus } from '../state/store';
import { MONO, SectionLabel } from '../ui/primitives';

const SRC_TONE: Record<string, [bg: string, color: string, bd: string]> = {
  Greenhouse: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Lever: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Ashby: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Workable: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Workday: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  SmartRecruiters: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  BambooHR: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  RSS: ['#EFEBE1', '#6E685D', '#E0DBD0'],
};

// Display ATS name → lowercase provider id for verifyBoard. RSS is omitted on
// purpose — an aggregate feed isn't a direct board, so those pills are inert.
const SRC_PROVIDER: Record<string, string> = {
  Greenhouse: 'greenhouse',
  Lever: 'lever',
  Ashby: 'ashby',
  Workable: 'workable',
  SmartRecruiters: 'smartrecruiters',
  BambooHR: 'bamboohr',
  Workday: 'workday',
};

// Verify-state pill overlays (reuse the caution/risk palettes already in use
// below), plus the glyph + tooltip per state.
const CHECK_TONE: Record<'ok' | 'fail' | 'error', [string, string, string]> = {
  ok: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  fail: ['var(--rr-risk-tint)', 'var(--rr-risk-strong)', '#E6CBBE'],
  error: ['#FBF6E9', '#8A5E14', '#E9DBB6'],
};
const CHECK_GLYPH: Record<BoardCheckStatus, string> = {
  idle: '',
  checking: '◎',
  ok: '✓',
  fail: '✗',
  error: '?',
};
const CHECK_TITLE: Record<BoardCheckStatus, string> = {
  idle: 'Click to verify this board is reachable',
  checking: 'Checking…',
  ok: 'Reachable',
  fail: 'Board not found',
  error: "Couldn't check — try again (or backend not deployed)",
};

interface CoGroup {
  name: string;
  key: string;
  boards: WatchEntry[];
}
const checkKey = (name: string, src: string) => `${name.toLowerCase()}:${src}`;
const letterOf = (n: string) => {
  const c = n.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

export function SearchView() {
  const { state, dispatch, api } = useStore();
  const [newTerms, setNewTerms] = useState<Record<number, string>>({});
  const [newCompany, setNewCompany] = useState('');
  const [resolving, setResolving] = useState(false);

  const addTerm = (gi: number) => {
    const term = (newTerms[gi] || '').trim();
    if (!term) return;
    dispatch({ type: 'ADD_TERM', group: gi, term });
    setNewTerms((m) => ({ ...m, [gi]: '' }));
  };

  const addCompany = async () => {
    const text = newCompany.trim();
    if (!text || resolving) return;
    // A pasted careers URL resolves provider + slug directly.
    const fromUrl = resolveCareersUrl(text);
    if (fromUrl) {
      dispatch({ type: 'ADD_CO', entry: fromUrl });
      setNewCompany('');
      return;
    }
    // Plain names (comma-separated for bulk adds): Radar probes every ATS for
    // each company — one row lands per board found (companies often run more
    // than one). No board → aggregate feeds still cover it (RSS tag).
    const names = text
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    setResolving(true);
    for (const name of names) {
      const boards = await api.resolveCompany(name);
      const entries = boards.length
        ? boards
        : [
            state.connected
              ? { name, src: 'RSS', slug: normalizeSlug(name) }
              : { name, src: 'Greenhouse', slug: normalizeSlug(name) },
          ];
      for (const entry of entries) dispatch({ type: 'ADD_CO', entry });
    }
    setResolving(false);
    setNewCompany('');
  };

  // Alphabetical, then by provider — long lists stay scannable, and a
  // company's multiple boards (e.g. SAP on Workable and Greenhouse) group.
  const watchlist = state.watchlist
    .filter((w) => !state.excluded.includes(w.name))
    .sort((a, b) => a.name.localeCompare(b.name) || a.src.localeCompare(b.src));

  // Fold the (already name-sorted) entries into one group per company so each
  // company renders as a single row with one pill per board.
  const groups: CoGroup[] = [];
  for (const w of watchlist) {
    const key = w.name.toLowerCase();
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.boards.push(w);
    else groups.push({ name: w.name, key, boards: [w] });
  }

  // Click a pill → probe that exact board (provider + slug the sweep pulls) and
  // record reachability. RSS pills are inert; design mode reports 'unavailable'.
  const runVerify = async (group: CoGroup, b: WatchEntry) => {
    const provider = SRC_PROVIDER[b.src];
    if (!provider) return;
    const key = checkKey(group.name, b.src);
    if (state.boardChecks[key]?.status === 'checking') return;
    dispatch({ type: 'BOARD_CHECK_START', key });
    const r = await api.verifyBoard(provider, b.slug ?? normalizeSlug(b.name));
    const status = r === 'unavailable' ? 'error' : r.ok ? 'ok' : r.status ? 'fail' : 'error';
    dispatch({ type: 'BOARD_CHECK_DONE', key, status });
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: '#FBF6E9',
          border: '1px solid #E9DBB6',
          borderRadius: 9,
          padding: '10px 14px',
          marginBottom: 18,
          maxWidth: 760,
        }}
      >
        <span style={{ color: 'var(--rr-caution)', fontSize: 12 }}>◈</span>
        <span style={{ fontSize: 12.5, color: '#7A6A3E' }}>
          Seeded from your résumé. Add suggested terms from <b>Profile</b>, or edit freely here.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 660 }}>
        <div style={{ width: '100%' }}>
          <SectionLabel style={{ marginBottom: 13 }}>SEARCH TERMS — GROUPED &amp; WEIGHTED</SectionLabel>
          {state.termGroups.map((grp, gi) => (
            <div
              key={grp.name}
              style={{
                background: 'var(--rr-surface)',
                border: '1px solid var(--rr-border)',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 11,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rr-ink)' }}>{grp.name}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--rr-faint)' }}>WEIGHT</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: i < grp.weight ? 'var(--rr-primary)' : '#E0DBCF',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {grp.terms.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontFamily: MONO,
                      fontSize: 11.5,
                      padding: '5px 10px',
                      borderRadius: 7,
                      background: '#F1EEE5',
                      color: '#3A352D',
                      border: '1px solid var(--rr-border)',
                    }}
                  >
                    {t}
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_TERM', group: gi, term: t })}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#B8B0A0',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 13,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                <input
                  value={newTerms[gi] || ''}
                  onChange={(e) => setNewTerms((m) => ({ ...m, [gi]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTerm(gi);
                  }}
                  placeholder="add a term to this group…"
                  style={{
                    flex: 1,
                    border: '1px solid var(--rr-border)',
                    background: 'var(--rr-surface)',
                    borderRadius: 7,
                    padding: '8px 11px',
                    fontFamily: MONO,
                    fontSize: 11.5,
                    color: 'var(--rr-ink)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => addTerm(gi)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px 14px',
                    borderRadius: 7,
                    background: '#211E18',
                    color: 'var(--rr-paper)',
                    fontFamily: MONO,
                    fontSize: 11,
                    flex: '0 0 auto',
                  }}
                >
                  + add
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: '100%' }}>
          <SectionLabel style={{ marginBottom: 13 }}>COMPANY WATCHLIST — DIRECT ATS PULL</SectionLabel>
          <div
            style={{
              background: 'var(--rr-surface)',
              border: '1px solid var(--rr-border)',
              borderRadius: 10,
              padding: '7px 8px',
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', gap: 7, padding: '5px 10px 10px' }}>
              <input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addCompany();
                }}
                placeholder="company name, or paste a careers URL (Greenhouse / Lever / Ashby)…"
                style={{
                  flex: 1,
                  border: '1px solid var(--rr-border)',
                  background: 'var(--rr-surface)',
                  borderRadius: 7,
                  padding: '8px 11px',
                  fontFamily: MONO,
                  fontSize: 11.5,
                  color: 'var(--rr-ink)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => void addCompany()}
                disabled={resolving}
                style={{
                  border: 'none',
                  cursor: resolving ? 'wait' : 'pointer',
                  padding: '8px 14px',
                  borderRadius: 7,
                  background: '#211E18',
                  color: 'var(--rr-paper)',
                  fontFamily: MONO,
                  fontSize: 11,
                  flex: '0 0 auto',
                  opacity: resolving ? 0.6 : 1,
                }}
              >
                {resolving ? '◎ finding board…' : '+ watch'}
              </button>
            </div>
            <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
              {groups.map((group, i) => {
                const paused = !!state.watchPaused[group.name];
                const hasAts = group.boards.some((b) => b.src !== 'RSS');
                const showHeader = i === 0 || letterOf(groups[i - 1].name) !== letterOf(group.name);
                return (
                  <Fragment key={group.key}>
                    {showHeader && (
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 10,
                          letterSpacing: '0.08em',
                          color: 'var(--rr-faint)',
                          background: 'var(--rr-surface)',
                          padding: '6px 10px 3px',
                          borderBottom: '1px solid var(--rr-border)',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        {letterOf(group.name)}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '8px 10px',
                        borderRadius: 7,
                        background: i % 2 ? 'rgba(0,0,0,0.015)' : 'transparent',
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: paused || !hasAts ? '#D8D3C8' : 'var(--rr-primary)',
                          flex: '0 0 auto',
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: paused ? '#A39C8B' : 'var(--rr-ink)',
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {group.name}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                          flex: '0 0 auto',
                        }}
                      >
                        {group.boards.map((b) => {
                          const status: BoardCheckStatus =
                            state.boardChecks[checkKey(group.name, b.src)]?.status ?? 'idle';
                          const verifiable = !!SRC_PROVIDER[b.src];
                          const tone =
                            status === 'ok' || status === 'fail' || status === 'error'
                              ? CHECK_TONE[status]
                              : SRC_TONE[b.src] ?? SRC_TONE.RSS;
                          const glyph = CHECK_GLYPH[status];
                          const showPillX = group.boards.length > 1 && b.src !== 'RSS';
                          return (
                            <span
                              key={`${group.key}:${b.src}`}
                              role={verifiable ? 'button' : undefined}
                              tabIndex={verifiable ? 0 : undefined}
                              onClick={verifiable ? () => void runVerify(group, b) : undefined}
                              title={
                                verifiable
                                  ? CHECK_TITLE[status]
                                  : 'Aggregate feed — not a direct ATS board'
                              }
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontFamily: MONO,
                                fontSize: 10,
                                padding: '2px 7px',
                                borderRadius: 5,
                                background: tone[0],
                                color: tone[1],
                                border: `1px solid ${tone[2]}`,
                                cursor: verifiable ? 'pointer' : 'default',
                                opacity: status === 'checking' ? 0.7 : 1,
                              }}
                            >
                              {b.src}
                              {glyph && <span aria-hidden="true">{glyph}</span>}
                              {showPillX && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({ type: 'REMOVE_CO', name: group.name, src: b.src });
                                  }}
                                  title={`Remove ${b.src} board`}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: tone[1],
                                    cursor: 'pointer',
                                    padding: 0,
                                    marginLeft: 1,
                                    fontSize: 12,
                                    lineHeight: 1,
                                    opacity: 0.65,
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </span>
                      <button
                        onClick={() => dispatch({ type: 'TOGGLE_PAUSE_CO', name: group.name })}
                        style={{
                          border: '1px solid #E2DDD1',
                          background: 'var(--rr-paper)',
                          color: 'var(--rr-muted)',
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontFamily: MONO,
                          fontSize: 10,
                          flex: '0 0 auto',
                        }}
                      >
                        {paused ? 'resume' : 'pause'}
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'REMOVE_CO', name: group.name })}
                        title="Remove company from watchlist"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#B0A899',
                          cursor: 'pointer',
                          fontSize: 15,
                          lineHeight: 1,
                          padding: '2px 4px',
                          flex: '0 0 auto',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {state.excluded.length > 0 && (
            <>
              <SectionLabel style={{ marginBottom: 13 }}>
                EXCLUDED COMPANIES — HIDDEN FROM ALL SOURCES
              </SectionLabel>
              <div
                style={{
                  background: 'var(--rr-risk-tint)',
                  border: '1px solid #E6CBBE',
                  borderRadius: 10,
                  padding: '7px 8px',
                  marginBottom: 18,
                }}
              >
                {state.excluded.map((name) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rr-risk)', flex: '0 0 auto' }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--rr-risk-strong)' }}>{name}</span>
                    <button
                      onClick={() => dispatch({ type: 'UNMUTE_CO', name })}
                      style={{
                        border: '1px solid #E6CBBE',
                        background: 'var(--rr-surface)',
                        color: 'var(--rr-risk-strong)',
                        cursor: 'pointer',
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontFamily: MONO,
                        fontSize: 10,
                        flex: '0 0 auto',
                      }}
                    >
                      un-mute
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <SectionLabel style={{ marginBottom: 13 }}>ACTIVE SOURCES — PLUGGABLE ADAPTERS</SectionLabel>
          <div
            style={{
              background: 'var(--rr-surface)',
              border: '1px solid var(--rr-border)',
              borderRadius: 10,
              padding: '7px 8px',
            }}
          >
            {state.sources.map((s) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 10, borderRadius: 7 }}>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_SOURCE', name: s.name })}
                  aria-label={`Toggle ${s.name}`}
                  style={{
                    width: 34,
                    height: 18,
                    borderRadius: 9,
                    border: 'none',
                    padding: 0,
                    cursor: s.tag === 'MANUAL' ? 'default' : 'pointer',
                    background: s.on ? (s.tag === 'MANUAL' ? 'var(--rr-caution)' : 'var(--rr-primary)') : '#D8D3C8',
                    position: 'relative',
                    flex: '0 0 auto',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: s.on ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      transition: 'left .12s',
                    }}
                  />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--rr-ink)' }}>{s.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--rr-faint)', marginTop: 1 }}>
                    {s.note}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: s.tag === 'ACTIVE' ? '#0F6B3B' : s.tag === 'MANUAL' ? '#8A5E14' : '#B0A899',
                  }}
                >
                  {s.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
