// Search & watchlist (single column, ~660px): grouped weighted search-term
// cards (each with its own add-term input), the company watchlist (ATS tag,
// pause/resume, remove), excluded companies (rust, un-mute), active sources.

import { useState } from 'react';
import { useStore } from '../state/store';
import { MONO, SectionLabel } from '../ui/primitives';

const SRC_TONE: Record<string, [bg: string, color: string, bd: string]> = {
  Greenhouse: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Lever: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Ashby: ['#E7F1E8', '#0F6B3B', '#C5DDCB'],
  Workday: ['#F4ECDA', '#8A5E14', '#E3D2A8'],
  RSS: ['#EFEBE1', '#6E685D', '#E0DBD0'],
};

export function SearchView() {
  const { state, dispatch } = useStore();
  const [newTerms, setNewTerms] = useState<Record<number, string>>({});

  const addTerm = (gi: number) => {
    const term = (newTerms[gi] || '').trim();
    if (!term) return;
    dispatch({ type: 'ADD_TERM', group: gi, term });
    setNewTerms((m) => ({ ...m, [gi]: '' }));
  };

  const watchlist = state.watchlist.filter((w) => !state.excluded.includes(w.name));

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
            {watchlist.map((c) => {
              const paused = !!state.watchPaused[c.name];
              const tone = SRC_TONE[c.src] ?? SRC_TONE.RSS;
              return (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: paused ? '#D8D3C8' : c.src === 'RSS' ? '#D8D3C8' : 'var(--rr-primary)',
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
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 5,
                      background: tone[0],
                      color: tone[1],
                      border: `1px solid ${tone[2]}`,
                      flex: '0 0 auto',
                    }}
                  >
                    {c.src}
                  </span>
                  <button
                    onClick={() => dispatch({ type: 'TOGGLE_PAUSE_CO', name: c.name })}
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
                    onClick={() => dispatch({ type: 'REMOVE_CO', name: c.name })}
                    title="Remove from watchlist"
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
              );
            })}
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
