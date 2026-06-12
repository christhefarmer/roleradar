// Recommended — the signature view. Ranked role cards with verdict pill,
// mono fit score, 8-segment dimension meter, reason chips and flags; expanding
// reveals the transparent fit breakdown. A score is never shown without its why.

import type { CSSProperties } from 'react';
import { DIMS } from '../data/seed';
import type { Role } from '../domain/types';
import { useStore } from '../state/store';
import { EligBadge, formatDiscovered, MONO } from '../ui/primitives';
import { VERDICTS, chipTone, defNote, eligVm, fillColor, fillFor, meterColor } from '../ui/tones';

function filterToggleStyle(on: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    border: `1px solid ${on ? '#211E18' : 'var(--rr-border)'}`,
    background: on ? '#211E18' : 'var(--rr-surface)',
    color: on ? 'var(--rr-paper)' : 'var(--rr-faint)',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 7,
    fontFamily: MONO,
    fontSize: 11,
  };
}

export function RecommendedView() {
  const { state, dispatch, startRun } = useStore();

  let list = state.roles.filter(
    (r) => !state.dismissed[r.id] && !state.excluded.includes(r.company),
  );
  // Canada or remote only: confirmed-CA and regionless-remote pass; US-only,
  // elsewhere-international and unclassifiable stay hidden unless overridden.
  if (state.canadaOnly)
    list = list.filter(
      (r) => r.elig.state === 'ca' || r.elig.state === 'remote' || state.overrides[r.id],
    );
  if (state.hideBelow) list = list.filter((r) => r.verdict !== 'below' && r.verdict !== 'mismatch');
  const tierOf = (r: Role) => (r.verdict === 'below' || r.verdict === 'mismatch' ? 2 : 0);
  list = [...list].sort((a, b) => {
    if (state.sortBy === 'new') return a.days - b.days;
    const t = tierOf(a) - tierOf(b);
    return t !== 0 ? t : b.score - a.score;
  });

  return (
    <>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--rr-faint)', letterSpacing: '0.06em' }}>
          SORT
        </span>
        <button
          onClick={() => dispatch({ type: 'SET_SORT', sortBy: 'fit' })}
          style={filterToggleStyle(state.sortBy === 'fit')}
        >
          fit
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_SORT', sortBy: 'new' })}
          style={filterToggleStyle(state.sortBy === 'new')}
        >
          newest
        </button>
        <span style={{ width: 1, height: 20, background: '#E2DDD1', margin: '0 4px' }} />
        <button onClick={() => dispatch({ type: 'TOGGLE_CANADA' })} style={filterToggleStyle(state.canadaOnly)}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: state.canadaOnly ? '#7BC99A' : '#D8D3C8',
            }}
          />
          Canada-eligible only
        </button>
        <button onClick={() => dispatch({ type: 'TOGGLE_BELOW' })} style={filterToggleStyle(state.hideBelow)}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: state.hideBelow ? '#7BC99A' : '#D8D3C8',
            }}
          />
          Hide below-level
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--rr-faint)' }}>
          {list.length} roles shown
        </span>
      </div>

      {list.map((r, idx) => (
        <RoleCard key={r.id} role={r} rank={idx + 1} />
      ))}

      {list.length === 0 && (
        <div
          style={{
            border: '1px dashed #DCD6C9',
            borderRadius: 12,
            padding: '56px 28px',
            textAlign: 'center',
            maxWidth: 760,
          }}
        >
          <div style={{ fontSize: 24, color: '#C4BCAC', marginBottom: 10 }}>◎</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#3A352D' }}>
            {state.roles.length === 0 ? 'No roles yet' : 'Nothing matches these filters'}
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--rr-faint)',
              maxWidth: 420,
              margin: '8px auto 16px',
              lineHeight: 1.55,
            }}
          >
            {state.roles.length === 0
              ? 'Go to Range to set the range and scope for your scouts — search terms, watchlist companies and sources — then send them out.'
              : 'Loosen a filter, or run another sweep to bring in fresh postings.'}
          </p>
          {state.roles.length === 0 ? (
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'search' })}
              className="rr-btn-primary"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '10px 18px',
                borderRadius: 8,
                color: '#fff',
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              ≋ SET YOUR RANGE
            </button>
          ) : (
            <button
              onClick={startRun}
              className="rr-btn-primary"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '10px 18px',
                borderRadius: 8,
                color: '#fff',
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              ▸ SEND SCOUTS
            </button>
          )}
        </div>
      )}
    </>
  );
}

function RoleCard({ role: r, rank }: { role: Role; rank: number }) {
  const { state, dispatch } = useStore();
  const v = VERDICTS[r.verdict];
  const elig = eligVm(r.elig);
  const expanded = !!state.expanded[r.id];
  const overridden = !!state.overrides[r.id];
  const blocked = r.elig.state === 'us' || r.elig.state === 'other';
  const down = r.down || (blocked && !overridden);
  const stage = state.pipeline[r.id];
  const scoreColor = r.verdict === 'below' || r.verdict === 'mismatch' ? '#A39C8B' : v.color;

  const flag = r.phantom
    ? {
        label: '⚠ PHANTOM RISK',
        text: `Seen ${r.phantom.seen}× over ${r.phantom.days} days — never observed to fill.`,
        dots: r.phantom.runs.map((on) => ({
          bg: on ? '#B0492B' : 'transparent',
          bd: on ? '#B0492B' : '#D8C8BF',
        })),
      }
    : blocked && overridden
      ? {
          label: '✕ INELIGIBLE',
          text:
            r.elig.state === 'us'
              ? 'US work authorization required — shown because you overrode the Canada filter.'
              : 'Located outside Canada — shown because you overrode the Canada filter.',
          dots: [] as { bg: string; bd: string }[],
        }
      : null;

  return (
    <div
      style={{
        background: 'var(--rr-surface)',
        border: '1px solid var(--rr-border)',
        borderLeft: `3px solid ${v.color}`,
        borderRadius: 10,
        marginBottom: 11,
        opacity: down ? 0.66 : 1,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => dispatch({ type: 'TOGGLE_EXPAND', id: r.id })}
        style={{ display: 'flex', gap: 16, padding: '16px 18px', cursor: 'pointer', alignItems: 'flex-start' }}
      >
        <div style={{ fontFamily: MONO, fontSize: 13, color: '#B8B0A0', width: 24, flex: '0 0 auto', paddingTop: 2 }}>
          {String(rank).padStart(2, '0')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--rr-ink)', letterSpacing: '-0.01em' }}>
              {r.title}
            </span>
            <EligBadge elig={r.elig} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#8A8475', marginTop: 5 }}>
            {[
              r.company,
              r.location,
              r.salary,
              r.source,
              // "seen Nd" keeps the repost framing; otherwise show the exact
              // discovery timestamp when we have one.
              r.posted.startsWith('seen')
                ? r.posted
                : r.discoveredAt
                  ? `found ${formatDiscovered(r.discoveredAt)}`
                  : /^\d+d$/.test(r.posted)
                    ? `${r.posted} ago`
                    : r.posted,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 12, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 6,
                background: v.bg,
                color: v.color,
                border: `1px solid ${v.bd}`,
                letterSpacing: '0.04em',
              }}
            >
              {v.label}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: scoreColor }}>
              {r.score}
              <span style={{ fontSize: 10, color: '#B8B0A0', fontWeight: 400 }}>/100</span>
            </span>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }} title="fit by dimension">
              {DIMS.map(([k, label]) => (
                <span
                  key={k}
                  title={label}
                  style={{ width: 15, height: 7, borderRadius: 2, background: meterColor(r.dims[k]) }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
            {r.chips.map(([text, tone]) => {
              const t = chipTone(tone);
              return (
                <span
                  key={text}
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: t.bg,
                    color: t.color,
                    border: `1px solid ${t.bd}`,
                  }}
                >
                  {text}
                </span>
              );
            })}
          </div>

          {flag && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 11,
                padding: '9px 11px',
                background: 'var(--rr-risk-tint)',
                border: '1px solid #E6CBBE',
                borderRadius: 7,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--rr-risk)',
                  letterSpacing: '0.04em',
                }}
              >
                {flag.label}
              </span>
              <span style={{ fontSize: 12, color: '#8A5340' }}>{flag.text}</span>
              <span style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 3 }}>
                {flag.dots.map((d, i) => (
                  <span
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: d.bg,
                      border: `1px solid ${d.bd}`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flex: '0 0 auto' }}>
          <span style={{ fontFamily: MONO, fontSize: 16, color: '#C4BCAC' }}>{expanded ? '−' : '+'}</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 6,
              background: stage ? 'var(--rr-primary-tint)' : '#F1EEE5',
              color: stage ? '#0F6B3B' : 'var(--rr-faint)',
              border: `1px solid ${stage ? '#C5DDCB' : 'var(--rr-border)'}`,
              whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
            }}
          >
            {stage ? `● ${stage.toUpperCase()}` : '+ pipeline'}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px dashed #E0DACE', background: '#FCFBF8', padding: '20px 22px' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 18 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: v.color, flex: '0 0 auto', paddingTop: 2 }}>
              VERDICT
            </span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#3A352D', textWrap: 'pretty', maxWidth: 680 }}>
              {r.sentence}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', letterSpacing: '0.08em' }}>
              FIT BREAKDOWN — WHY THIS RANKS WHERE IT DOES
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9.5,
                color: '#6B4FA8',
                background: '#EDE8F5',
                border: '1px solid #D5CAE8',
                borderRadius: 5,
                padding: '1px 7px',
              }}
            >
              ◈ scored vs your résumé profile
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {DIMS.map(([k, label]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
                <span style={{ width: 172, flex: '0 0 auto', fontFamily: MONO, fontSize: 11, color: 'var(--rr-muted)' }}>
                  {label}
                </span>
                <div style={{ flex: '0 0 120px', height: 7, background: '#EBE6DB', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: fillFor(r.dims[k]),
                      background: fillColor(r.dims[k]),
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: '#7A7468' }}>
                  {r.notes[k] ?? defNote(r.dims[k])}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: '#F4F1E9',
              border: '1px solid #E6E1D5',
              borderRadius: 9,
              padding: '13px 15px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 11,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: elig.color,
                border: `1px solid ${elig.bd}`,
                background: elig.bg,
                padding: '2px 7px',
                borderRadius: 5,
                flex: '0 0 auto',
              }}
            >
              {elig.label}
            </span>
            <span style={{ flex: 1, minWidth: 240, fontSize: 12.5, color: '#5E594E', lineHeight: 1.55 }}>
              {r.elig.detail}
            </span>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_OVERRIDE', id: r.id })}
              style={{
                border: '1px solid #D8D2C5',
                background: 'var(--rr-surface)',
                color: 'var(--rr-muted)',
                cursor: 'pointer',
                padding: '5px 11px',
                borderRadius: 6,
                fontFamily: MONO,
                fontSize: 10.5,
              }}
            >
              {overridden
                ? 'Mark ineligible'
                : r.elig.state === 'us'
                  ? 'I have US auth'
                  : r.elig.state === 'ca'
                    ? 'Mark ineligible'
                    : 'Mark eligible'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button
              onClick={() => dispatch({ type: 'ADD_TO_PIPE', id: r.id })}
              className="rr-btn-primary"
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '9px 16px',
                borderRadius: 7,
                color: '#fff',
                fontFamily: MONO,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              {stage ? `In pipeline · ${stage}` : '+ Add to pipeline'}
            </button>
            <button
              onClick={() => {
                if (r.url) window.open(r.url, '_blank', 'noopener');
              }}
              style={{
                border: '1px solid #D8D2C5',
                background: 'var(--rr-surface)',
                color: '#3A352D',
                cursor: 'pointer',
                padding: '9px 16px',
                borderRadius: 7,
                fontFamily: MONO,
                fontSize: 11.5,
              }}
            >
              Open posting ↗
            </button>
            <button
              onClick={() => dispatch({ type: 'DISMISS_ROLE', id: r.id })}
              style={{
                border: '1px solid #E2DDD1',
                background: 'transparent',
                color: 'var(--rr-faint)',
                cursor: 'pointer',
                padding: '9px 16px',
                borderRadius: 7,
                fontFamily: MONO,
                fontSize: 11.5,
              }}
            >
              Dismiss
            </button>
            <button
              onClick={() => dispatch({ type: 'MUTE_CO', name: r.company })}
              title="Never show roles from this company"
              style={{
                border: '1px solid #E2DDD1',
                background: 'transparent',
                color: 'var(--rr-faint)',
                cursor: 'pointer',
                padding: '9px 16px',
                borderRadius: 7,
                fontFamily: MONO,
                fontSize: 11.5,
              }}
            >
              Mute company
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
