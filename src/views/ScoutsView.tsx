// Scouts — the agent loop. Guardrail chips, agent-status card (pulse dot,
// autonomy dial, pause, loop pipeline), the live sweep, the discovery trace,
// and a pointer to the approval queue in the assistant rail.

import { GUARDRAILS, RADAR_STAGES, TRACES } from '../data/seed';
import type { Autonomy, RunStatus } from '../domain/types';
import { useStore } from '../state/store';
import { RadarAvatar } from '../ui/HatGlasses';
import { MONO, SectionLabel } from '../ui/primitives';

const AUTONOMY: { key: Autonomy; label: string; hint: string }[] = [
  { key: 'conservative', label: 'CONSERVATIVE', hint: 'Only exact-term, title matches.' },
  { key: 'balanced', label: 'BALANCED', hint: 'Adjacent titles + description content matches.' },
  { key: 'wide', label: 'WIDE', hint: 'Also hypothesise new companies and sources.' },
];

const RUN_STATUS_VM: Record<
  RunStatus,
  [dotBg: string, dotBd: string, nameColor: string, statColor: string]
> = {
  pending: ['transparent', '#D8D3C8', '#97907F', '#B0A899'],
  scanning: ['#F4ECDA', '#C39237', '#211E18', '#8A5E14'],
  done: ['#1E8A4F', '#1E8A4F', '#211E18', '#0F6B3B'],
  manual: ['#B07D26', '#B07D26', '#211E18', '#8A5E14'],
  error: ['#B0492B', '#B0492B', '#8A4A2C', '#B0492B'],
};

export function ScoutsView() {
  const { state, dispatch } = useStore();
  const { running, radarPaused: paused, runDone } = state;

  const queue = state.proposals.filter((p) => !state.proposalState[p.id]).length;
  const stateLabel = paused ? 'PAUSED' : running ? 'SCOUTS DEPLOYED…' : 'ON · SCOUTS ON PATROL';
  const sub = paused
    ? 'Paused — scouts are recalled until you resume.'
    : running
      ? 'Your scouts are combing your sources and reasoning against your résumé…'
      : 'Radar sends scouts across your sources, then brings you what fits to approve — it never acts alone.';

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {GUARDRAILS.map((g) => (
          <span
            key={g}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: MONO,
              fontSize: 10.5,
              padding: '5px 10px',
              borderRadius: 7,
              background: '#F1EEE5',
              color: 'var(--rr-muted)',
              border: '1px solid var(--rr-border)',
            }}
          >
            <span style={{ color: 'var(--rr-primary)' }}>✓</span>
            {g}
          </span>
        ))}
      </div>

      <div
        style={{
          background: 'var(--rr-surface)',
          border: '1px solid var(--rr-border)',
          borderRadius: 12,
          padding: '18px 20px',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: paused ? '#C39237' : 'var(--rr-primary)',
                animation: running
                  ? 'radarpulse 1.4s infinite'
                  : paused
                    ? 'none'
                    : 'radarpulse 2.8s infinite',
                flex: '0 0 auto',
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'var(--rr-ink)',
                }}
              >
                RADAR · {stateLabel}
              </div>
              <div style={{ fontSize: 12, color: '#7A7468', marginTop: 2 }}>{sub}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', letterSpacing: '0.05em' }}>
              AUTONOMY
            </span>
            <div style={{ display: 'flex', border: '1px solid var(--rr-border)', borderRadius: 8, overflow: 'hidden' }}>
              {AUTONOMY.map((a) => {
                const active = state.autonomy === a.key;
                return (
                  <button
                    key={a.key}
                    title={a.hint}
                    onClick={() => dispatch({ type: 'SET_AUTONOMY', autonomy: a.key })}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      padding: '7px 12px',
                      background: active ? '#211E18' : 'var(--rr-surface)',
                      color: active ? 'var(--rr-paper)' : 'var(--rr-muted)',
                      fontFamily: MONO,
                      fontSize: 10.5,
                      letterSpacing: '0.02em',
                      borderRight: '1px solid var(--rr-border)',
                    }}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_RADAR_PAUSE' })}
              style={{
                border: '1px solid var(--rr-border)',
                background: 'var(--rr-paper)',
                color: 'var(--rr-muted)',
                cursor: 'pointer',
                padding: '7px 13px',
                borderRadius: 8,
                fontFamily: MONO,
                fontSize: 10.5,
              }}
            >
              {paused ? '▸ Resume' : '❚❚ Pause'}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            flexWrap: 'wrap',
            marginTop: 17,
            paddingTop: 16,
            borderTop: '1px solid var(--rr-hairline)',
          }}
        >
          {RADAR_STAGES.map((s, i) => {
            const active = running ? i <= state.radarStage : i === 4;
            return (
              <span key={s.key} style={{ display: 'contents' }}>
                {i > 0 && <span style={{ color: '#CFC8B8', fontSize: 11 }}>›</span>}
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    padding: '5px 11px',
                    borderRadius: 7,
                    background: active ? 'var(--rr-primary-tint)' : '#F4F1E9',
                    color: active ? '#0F6B3B' : '#A39C8B',
                    border: `1px solid ${active ? '#C5DDCB' : '#EAE5D9'}`,
                    letterSpacing: '0.04em',
                  }}
                >
                  {s.label}
                </span>
              </span>
            );
          })}
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: '#A39C8B' }}>
            {running
              ? 'sweep in progress'
              : paused
                ? 'standing by'
                : `on-demand · last sweep ${state.summary.when}`}
          </span>
        </div>

        {(running || runDone) && (
          <>
            <div style={{ marginTop: 16, border: '1px solid var(--rr-hairline)', borderRadius: 10, overflow: 'hidden' }}>
              {state.runSources.map((s) => {
                const [dotBg, dotBd, nameColor, statColor] = RUN_STATUS_VM[s.status];
                const statLabel =
                  s.status === 'pending'
                    ? 'queued'
                    : s.status === 'scanning'
                      ? 'fetching…'
                      : s.status === 'manual'
                        ? 'manual — paste'
                        : s.status === 'error'
                          ? '⚠ skipped'
                          : `✓ ${s.count}`;
                return (
                  <div
                    key={s.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      padding: '11px 15px',
                      borderBottom: '1px solid #F2EEE4',
                    }}
                  >
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: dotBg,
                        border: `2px solid ${dotBd}`,
                        flex: '0 0 auto',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: nameColor }}>{s.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--rr-faint)', marginTop: 1 }}>
                        {s.detail}
                      </div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: statColor, letterSpacing: '0.03em' }}>
                      {statLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            {runDone && (
              <div
                style={{
                  marginTop: 14,
                  background: state.runError ? 'var(--rr-risk-tint)' : 'var(--rr-primary-tint)',
                  border: `1px solid ${state.runError ? '#E6CBBE' : '#C5DDCB'}`,
                  borderRadius: 10,
                  padding: '13px 16px',
                  fontFamily: MONO,
                  fontSize: 11.5,
                  color: state.runError ? 'var(--rr-risk-strong)' : '#0F6B3B',
                  lineHeight: 1.65,
                }}
              >
                {state.runSummary}
              </div>
            )}
          </>
        )}
      </div>

      <SectionLabel style={{ letterSpacing: '0.06em', marginBottom: 4 }}>
        DISCOVERY TRACE — WHAT YOUR SCOUTS REASONED FROM YOUR RÉSUMÉ
      </SectionLabel>
      <div style={{ fontSize: 12.5, color: '#7A7468', marginBottom: 13 }}>
        Every hidden role traces back to a strength on your profile. No black-box expansion.
      </div>
      {state.connected && (
        <div
          style={{
            border: '1px dashed #DCD6C9',
            borderRadius: 10,
            padding: '20px 18px',
            marginBottom: 26,
            fontSize: 12.5,
            color: 'var(--rr-faint)',
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          Traces appear once the AI expansion pass runs on your sweeps — parse your profile, run a
          sweep, and the scouts will start reasoning from your strengths.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
        {(state.connected ? [] : TRACES).map((t) => (
          <div
            key={t.from}
            style={{
              background: 'var(--rr-surface)',
              border: '1px solid var(--rr-border)',
              borderRadius: 10,
              padding: '15px 17px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10.5,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: '#EDE8F5',
                  color: '#6B4FA8',
                  border: '1px solid #D5CAE8',
                }}
              >
                ◈ {t.from}
              </span>
              <span style={{ color: '#CFC8B8' }}>→</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', letterSpacing: '0.04em' }}>
                HYPOTHESIS
              </span>
            </div>
            <p style={{ margin: '9px 0 11px', fontSize: 13, color: '#3A352D', lineHeight: 1.55, textWrap: 'pretty' }}>
              {t.hyp}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: '#0F6B3B' }}>
                ↳ FOUND {t.count}
              </span>
              {t.finds.map((f) => (
                <span
                  key={f}
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    padding: '3px 9px',
                    borderRadius: 6,
                    background: 'var(--rr-primary-tint)',
                    color: '#0F6B3B',
                    border: '1px solid #C5DDCB',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'var(--rr-surface)',
          border: '1px solid var(--rr-border)',
          borderLeft: '3px solid var(--rr-primary)',
          borderRadius: 10,
          padding: '15px 17px',
          flexWrap: 'wrap',
        }}
      >
        <RadarAvatar size={34} iconSize={19} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--rr-ink)' }}>
            {queue} moves are waiting with your assistant
          </div>
          <div style={{ fontSize: 12.5, color: '#7A7468', marginTop: 3 }}>
            The radar hands its proposals to your assistant — review and approve them there, in plain
            language.
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'OPEN_ASSISTANT' })}
          className="rr-btn-primary"
          style={{
            border: 'none',
            cursor: 'pointer',
            padding: '9px 16px',
            borderRadius: 8,
            color: '#fff',
            fontFamily: MONO,
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          Open assistant →
        </button>
      </div>
    </>
  );
}
