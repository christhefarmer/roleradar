// Sweep progress modal — a floating overlay shown while a sweep runs, from
// any view, so a long sweep never looks frozen. It mirrors the Scouts panel's
// live per-source progress and calls out the final save/score phase (which
// has no per-source ticks but is where a big watchlist spends real time).
// Dismissable to the background — the sweep keeps running either way.

import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { HatGlasses } from '../ui/HatGlasses';
import { MONO } from '../ui/primitives';

export function SweepModal() {
  const { state } = useStore();
  const [dismissed, setDismissed] = useState(false);

  // Re-show on each new sweep.
  useEffect(() => {
    if (state.running) setDismissed(false);
  }, [state.running]);

  if (!state.running || dismissed) return null;

  const sources = state.runSources.filter((s) => s.kind !== 'manual');
  const allFetched = sources.length > 0 && sources.every((s) => s.status === 'done' || s.status === 'error');
  // Sources all returned but the sweep is still running → the client is
  // persisting + AI-scoring the haul (the slow tail on a big watchlist).
  const phase = allFetched ? 'Saving and scoring what your scouts found…' : 'Scanning your sources…';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(33,30,24,0.34)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--rr-surface)',
          border: '1px solid var(--rr-border)',
          borderRadius: 16,
          boxShadow: 'var(--rr-shadow-float)',
          padding: '24px 24px 20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* radar sweep — the same animated mark as the mobile launch */}
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              border: '1px solid #E0DBCF',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, rgba(30,138,79,0.30), rgba(30,138,79,0) 90deg)',
                animation: 'radarsweep 1.4s linear infinite',
              }}
            />
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--rr-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 0 0 6px var(--rr-surface)',
              }}
            >
              <HatGlasses size={20} stroke="#fff" />
            </span>
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--rr-ink)',
              marginTop: 16,
            }}
          >
            SCOUTS ON PATROL
          </div>
          <div style={{ fontSize: 12.5, color: '#7A7468', marginTop: 5, lineHeight: 1.5 }}>{phase}</div>
        </div>

        <div
          style={{
            marginTop: 18,
            border: '1px solid var(--rr-hairline)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {sources.map((s) => {
            const dot =
              s.status === 'done'
                ? 'var(--rr-primary)'
                : s.status === 'error'
                  ? 'var(--rr-risk)'
                  : s.status === 'scanning'
                    ? '#C39237'
                    : '#D8D3C8';
            const label =
              s.status === 'done'
                ? `✓ ${s.count}`
                : s.status === 'error'
                  ? '⚠ skipped'
                  : s.status === 'scanning'
                    ? 'scanning…'
                    : 'queued';
            const labelColor =
              s.status === 'done'
                ? '#0F6B3B'
                : s.status === 'error'
                  ? 'var(--rr-risk)'
                  : s.status === 'scanning'
                    ? '#8A5E14'
                    : '#B0A899';
            return (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 13px',
                  borderBottom: '1px solid #F2EEE4',
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: dot,
                    flex: '0 0 auto',
                    animation: s.status === 'scanning' ? 'radarpulse 1.4s infinite' : 'none',
                  }}
                />
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--rr-ink)' }}>{s.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: labelColor, letterSpacing: '0.03em' }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--rr-faint)', lineHeight: 1.55, margin: '14px 2px 0' }}>
          A large watchlist can take a minute — scouts work one source at a time so nothing times
          out. You can keep using Radar while they finish.
        </p>

        <button
          onClick={() => setDismissed(true)}
          style={{
            width: '100%',
            marginTop: 14,
            border: '1px solid var(--rr-border)',
            background: 'var(--rr-paper)',
            color: 'var(--rr-muted)',
            cursor: 'pointer',
            padding: '10px',
            borderRadius: 9,
            fontFamily: MONO,
            fontSize: 11.5,
            letterSpacing: '0.04em',
          }}
        >
          Continue in background
        </button>
      </div>
    </div>
  );
}
