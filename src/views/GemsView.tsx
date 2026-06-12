// Hidden Gems — gold-keyed cards, each leading with *why it surfaced*
// (content match or company signal) and Confirm → promote / Dismiss.

import { gemsForView, hiddenPendingGemCount } from '../state/selectors';
import { useStore } from '../state/store';
import { EligBadge, MONO } from '../ui/primitives';

export function GemsView() {
  const { state, dispatch } = useStore();
  // Shared selector with the sidebar badge: role-dismissals hide the gem,
  // promoted gems live in Roles now, and the Canada filter applies.
  const gems = gemsForView(state);
  const hiddenByFilters = hiddenPendingGemCount(state);

  return (
    <>
      <div
        style={{
          maxWidth: 760,
          marginBottom: 20,
          background: '#FBF6E9',
          border: '1px solid #E9DBB6',
          borderRadius: 11,
          padding: '16px 18px',
          display: 'flex',
          gap: 13,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ color: 'var(--rr-caution)', fontSize: 18, flex: '0 0 auto', lineHeight: 1.2 }}>◆</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#5C4413' }}>
            Roles your search terms missed — surfaced on content, not titles.
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#7A6A3E', lineHeight: 1.55, textWrap: 'pretty' }}>
            Two ways in: <b>content match</b> (a generic title whose description is full of your stack)
            and <b>company signal</b> (a generalist role at a known Apple-heavy fleet). Confirm to
            promote into your ranked list, or dismiss.
          </p>
        </div>
      </div>

      {gems.length === 0 && (
        <div
          style={{
            border: '1px dashed #E6D4A6',
            borderRadius: 12,
            padding: '48px 28px',
            textAlign: 'center',
            maxWidth: 760,
          }}
        >
          <div style={{ fontSize: 24, color: '#D8C58F', marginBottom: 10 }}>◆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#5C4413' }}>
            {hiddenByFilters > 0 ? 'No gems match your filters' : 'No gems yet'}
          </div>
          <p style={{ fontSize: 12.5, color: '#9A8755', maxWidth: 420, margin: '8px auto 0', lineHeight: 1.55 }}>
            {hiddenByFilters > 0 ? (
              <>
                {hiddenByFilters} pending gem{hiddenByFilters > 1 ? 's are' : ' is'} hidden — most
                likely by the <b>Canada-eligible only</b> filter (or an excluded company). Toggle the
                filter off in Roles to review {hiddenByFilters > 1 ? 'them' : 'it'}.
              </>
            ) : (
              <>
                Gems surface when a sweep finds a role whose title missed your terms but whose
                content matches your stack. Run sweeps regularly — these are the ones worth the
                patience.
              </>
            )}
          </p>
        </div>
      )}

      {gems.map((g) => {
        const d = state.gemDecisions[g.id];
        return (
          <div
            key={g.id}
            style={{
              background: '#FDFBF4',
              border: '1px dashed #E6D4A6',
              borderLeft: '3px solid var(--rr-caution)',
              borderRadius: 10,
              marginBottom: 11,
              padding: '16px 18px',
              opacity: d === 'dismissed' ? 0.5 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={{ color: 'var(--rr-caution)', fontSize: 13 }}>◆</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--rr-caution-strong)',
                  letterSpacing: '0.08em',
                }}
              >
                HIDDEN GEM
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 5,
                  background: '#F2E7CC',
                  color: 'var(--rr-caution-strong)',
                  border: '1px solid #E3D2A8',
                  letterSpacing: '0.04em',
                }}
              >
                {g.subtype}
              </span>
              <span style={{ flex: 1 }} />
              <EligBadge elig={g.elig} />
            </div>

            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rr-ink)' }}>{g.title}</div>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#8A8475', marginTop: 4 }}>
              {[g.company, g.location, g.source].filter(Boolean).join(' · ')}
            </div>

            <div
              style={{
                marginTop: 13,
                background: '#FCFBF6',
                border: '1px solid #ECE6D8',
                borderRadius: 9,
                padding: '13px 15px',
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: '#A39C8B',
                  letterSpacing: '0.06em',
                  marginBottom: 7,
                }}
              >
                {g.whyLabel}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#3A352D', lineHeight: 1.55, textWrap: 'pretty' }}>
                {g.whyText}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {g.matches.map((k) => (
                  <span
                    key={k}
                    style={{
                      fontFamily: MONO,
                      fontSize: 10.5,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'var(--rr-primary-tint)',
                      color: '#0F6B3B',
                      border: '1px solid #C5DDCB',
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 13, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#7A7468' }}>projected fit</span>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: '#3A352D' }}>
                ~{g.fit}
                <span style={{ fontSize: 10, color: '#B8B0A0' }}>/100</span>
              </span>
              <span style={{ flex: 1 }} />
              {g.url && (
                <button
                  onClick={() => window.open(g.url, '_blank', 'noopener')}
                  style={{
                    border: '1px solid #D8D2C5',
                    background: 'var(--rr-surface)',
                    color: '#3A352D',
                    cursor: 'pointer',
                    padding: '8px 15px',
                    borderRadius: 7,
                    fontFamily: MONO,
                    fontSize: 11,
                  }}
                >
                  Open posting ↗
                </button>
              )}
              {d ? (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: d === 'confirmed' ? '#0F6B3B' : '#A39C8B',
                  }}
                >
                  {d === 'confirmed' ? '✓ Promoted to recommendations' : '— Dismissed'}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => dispatch({ type: 'DECIDE_GEM', id: g.id, decision: 'confirmed' })}
                    className="rr-btn-primary"
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px 15px',
                      borderRadius: 7,
                      color: '#fff',
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Confirm → promote
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DECIDE_GEM', id: g.id, decision: 'dismissed' })}
                    style={{
                      border: '1px solid #E2DDD1',
                      background: 'transparent',
                      color: 'var(--rr-faint)',
                      cursor: 'pointer',
                      padding: '8px 15px',
                      borderRadius: 7,
                      fontFamily: MONO,
                      fontSize: 11,
                    }}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
