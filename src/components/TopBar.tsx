// Fixed top bar: view title + last-run status + the green Send-scouts action.

import { useStore } from '../state/store';
import type { ViewKey } from '../domain/types';
import { MONO } from '../ui/primitives';

const TITLES: Record<ViewKey, [string, string]> = {
  profile: ['Your profile', 'Résumé & LinkedIn — the source of truth fit is scored against'],
  radar: ['Scouts', 'Radar sends scouts across your sources — they propose, you approve'],
  recommend: ['Recommended', 'Ranked by fit — every score is explained'],
  gems: ['Hidden gems', 'Roles your search terms would have missed'],
  search: ['Search & watchlist', 'Manage terms, weights, companies and sources'],
  pipeline: ['Pipeline', 'Every role you are tracking, through to close'],
};

export function TopBar({ onBackToBot }: { onBackToBot?: () => void }) {
  const { state, startRun } = useStore();
  const [title, sub] = TITLES[state.view];
  const sm = state.summary;

  return (
    <header
      data-rr="topbar"
      style={{
        height: 74,
        flex: '0 0 auto',
        borderBottom: '1px solid #E2DDD1',
        background: 'var(--rr-paper)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 26px',
        gap: 18,
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBackToBot && (
          <button
            onClick={onBackToBot}
            title="Back to Radar"
            style={{
              border: '1px solid #E2DDD1',
              background: 'var(--rr-panel)',
              color: 'var(--rr-muted)',
              cursor: 'pointer',
              padding: '7px 11px',
              borderRadius: 8,
              fontFamily: MONO,
              fontSize: 11,
              flex: '0 0 auto',
            }}
          >
            ◎ bot
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--rr-faint)', marginTop: 2 }}>
            {sub}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: '0 0 auto' }}>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--rr-faint)', letterSpacing: '0.02em' }}
          >
            LAST RUN · {sm.when}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--rr-muted)' }}>
            {sm.kept} roles · {sm.phantoms} phantoms · {sm.gems} gems
          </div>
        </div>
        <button
          onClick={startRun}
          className={state.running ? undefined : 'rr-btn-primary'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            border: 'none',
            cursor: 'pointer',
            padding: '11px 18px',
            borderRadius: 8,
            background: state.running ? 'var(--rr-panel)' : undefined,
            color: state.running ? 'var(--rr-faint)' : '#fff',
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            boxShadow: state.running
              ? 'none'
              : '0 1px 0 #15623A, 0 2px 8px rgba(30,138,79,0.25)',
          }}
        >
          <span style={{ fontSize: 11 }}>{state.running ? '◎' : '▸'}</span>
          {state.running ? 'SCOUTING…' : 'SEND SCOUTS'}
        </button>
      </div>
    </header>
  );
}
