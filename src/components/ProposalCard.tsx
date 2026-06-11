// One Radar proposal as an approve/dismiss card. Approvals are the only thing
// that lets the bot act — shared by the assistant rail and the mobile bot.

import type { Proposal } from '../domain/types';
import { useStore } from '../state/store';
import { MONO } from '../ui/primitives';
import { proposalTone } from '../ui/tones';

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const { state, dispatch } = useStore();
  const st = state.proposalState[proposal.id];
  const tone = proposalTone(proposal.tone);
  return (
    <div
      style={{
        background: 'var(--rr-surface)',
        border: '1px solid var(--rr-border)',
        borderLeft: `3px solid ${tone.accent}`,
        borderRadius: 9,
        padding: '11px 12px',
        opacity: st === 'dismissed' ? 0.55 : 1,
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 600,
          padding: '2px 7px',
          borderRadius: 5,
          background: tone.tagBg,
          color: tone.tagColor,
          border: `1px solid ${tone.tagBd}`,
          letterSpacing: '0.05em',
        }}
      >
        {proposal.kind}
      </span>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--rr-ink)', marginTop: 7 }}>
        {proposal.title}
      </div>
      <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#7A7468', lineHeight: 1.5 }}>
        {proposal.rationale}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
        {!st ? (
          <>
            <button
              className="rr-btn-primary"
              onClick={() => dispatch({ type: 'APPROVE_PROPOSAL', id: proposal.id })}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '6px 13px',
                borderRadius: 6,
                color: '#fff',
                fontFamily: MONO,
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => dispatch({ type: 'DISMISS_PROPOSAL', id: proposal.id })}
              style={{
                border: '1px solid #E2DDD1',
                background: 'transparent',
                color: 'var(--rr-faint)',
                cursor: 'pointer',
                padding: '6px 13px',
                borderRadius: 6,
                fontFamily: MONO,
                fontSize: 10.5,
              }}
            >
              Dismiss
            </button>
          </>
        ) : (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              color: st === 'approved' ? '#0F6B3B' : '#A39C8B',
            }}
          >
            {st === 'approved' ? `✓ ${proposal.ok}` : '— Dismissed'}
          </span>
        )}
      </div>
    </div>
  );
}
