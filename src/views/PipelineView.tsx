// Pipeline — stages stacked top→bottom (New → … → Closed), each a band with
// a responsive card grid. Cards: title, company, eligibility, ↑ ↓ ×.

import { GEMS, PIPE_STAGES, ROLES } from '../data/seed';
import type { Eligibility } from '../domain/types';
import { useStore } from '../state/store';
import { EligBadge, MONO } from '../ui/primitives';

interface PipeCard {
  id: string;
  title: string;
  company: string;
  elig: Eligibility;
}

export function PipelineView() {
  const { state, dispatch } = useStore();

  const byId = new Map<string, PipeCard>();
  for (const r of [...ROLES, ...GEMS]) {
    byId.set(r.id, { id: r.id, title: r.title, company: r.company, elig: r.elig });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13, maxWidth: 940 }}>
      {PIPE_STAGES.map(([key, label, dot]) => {
        const cards = Object.keys(state.pipeline)
          .filter((id) => state.pipeline[id] === key)
          .map(
            (id) =>
              byId.get(id) ?? {
                id,
                title: id,
                company: '',
                elig: { state: 'ca' as const, label: 'CA ✓' },
              },
          );
        return (
          <div
            key={key}
            style={{
              background: 'var(--rr-panel)',
              border: '1px solid var(--rr-border)',
              borderRadius: 12,
              padding: '13px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: dot }} />
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#3A352D', letterSpacing: '0.05em' }}>
                {label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: '#A39C8B' }}>{cards.length}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))',
                gap: 9,
              }}
            >
              {cards.map((card) => (
                <div
                  key={card.id}
                  style={{
                    background: 'var(--rr-surface)',
                    border: '1px solid var(--rr-border)',
                    borderRadius: 8,
                    padding: '11px 12px',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rr-ink)', lineHeight: 1.3 }}>
                    {card.title}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: '#8A8475', marginTop: 4 }}>
                    {card.company}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                    <EligBadge elig={card.elig} fontSize={9.5} />
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={() => dispatch({ type: 'MOVE_STAGE', id: card.id, dir: -1 })}
                      title="Move up"
                      style={pipeBtnStyle('#F4F2EC', '#E2DDD1', '#97907F')}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'MOVE_STAGE', id: card.id, dir: 1 })}
                      title="Move down"
                      style={pipeBtnStyle('#F4F2EC', '#E2DDD1', '#6E685D')}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_FROM_PIPE', id: card.id })}
                      title="Remove from pipeline"
                      style={pipeBtnStyle('#F6EAE3', '#E6CBBE', '#B0492B')}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <div
                  style={{
                    gridColumn: '1/-1',
                    border: '1px dashed #DCD6C9',
                    borderRadius: 8,
                    padding: 13,
                    textAlign: 'center',
                    fontFamily: MONO,
                    fontSize: 10.5,
                    color: '#B0A899',
                    letterSpacing: '0.03em',
                  }}
                >
                  nothing here yet
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function pipeBtnStyle(bg: string, bd: string, color: string): React.CSSProperties {
  return {
    border: `1px solid ${bd}`,
    background: bg,
    color,
    cursor: 'pointer',
    width: 24,
    height: 24,
    borderRadius: 5,
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
  };
}
