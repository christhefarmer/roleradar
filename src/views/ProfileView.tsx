// Profile — the résumé textarea (source of truth) + LinkedIn paste (manual).
// On parse: strengths mapped to fit dimensions (confidence + weight dots +
// evidence quote), suggested search terms, suggested watchlist, profile facts.

import type { StrengthConfidence } from '../domain/types';
import { useStore } from '../state/store';
import { MONO, SectionLabel } from '../ui/primitives';

const CONF_VM: Record<
  StrengthConfidence,
  { label: string; color: string; bg: string; bd: string; bar: string }
> = {
  HIGH: { label: 'HIGH', color: '#0F6B3B', bg: '#E7F1E8', bd: '#C5DDCB', bar: '#1E8A4F' },
  MED: { label: 'MEDIUM', color: '#8A5E14', bg: '#F4ECDA', bd: '#E3D2A8', bar: '#C39237' },
  RARE: { label: '◆ RARE EDGE', color: '#6B4FA8', bg: '#EDE8F5', bd: '#D5CAE8', bar: '#8067C0' },
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  resize: 'vertical',
  border: '1px solid var(--rr-border)',
  background: 'var(--rr-surface)',
  borderRadius: 10,
  padding: '13px 14px',
  fontFamily: MONO,
  fontSize: 11.5,
  lineHeight: 1.6,
  color: '#3A352D',
  outline: 'none',
};

export function ProfileView() {
  const { state, dispatch, api } = useStore();
  const { strengths, sugTerms, sugCos, facts } = state;

  return (
    <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 296px', maxWidth: 296, minWidth: 280 }}>
        <SectionLabel style={{ marginBottom: 10 }}>SOURCE OF TRUTH — YOUR RÉSUMÉ</SectionLabel>
        <textarea
          value={state.resumeText}
          onChange={(e) => dispatch({ type: 'SET_RESUME', text: e.target.value })}
          spellCheck={false}
          placeholder="Paste your résumé here. Everything Radar does — fit scores, search expansion, gem detection — is measured against this text."
          style={{ ...textareaStyle, height: 230 }}
        />

        <SectionLabel style={{ margin: '16px 0 10px' }}>LINKEDIN PROFILE — PASTE (MANUAL)</SectionLabel>
        <textarea
          value={state.linkedinText}
          onChange={(e) => dispatch({ type: 'SET_LINKEDIN', text: e.target.value })}
          spellCheck={false}
          placeholder="Paste your LinkedIn ‘About’ + experience here. No automated LinkedIn pull — this keeps the account you network with safe."
          style={{ ...textareaStyle, height: 96 }}
        />

        <button
          onClick={() => void api.parseProfile()}
          disabled={state.parsing || !state.resumeText.trim()}
          className="rr-btn-primary"
          style={{
            width: '100%',
            marginTop: 14,
            border: 'none',
            cursor: state.parsing ? 'wait' : 'pointer',
            padding: 12,
            borderRadius: 9,
            color: '#fff',
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
            boxShadow: '0 1px 0 #15623A',
            opacity: state.parsing || !state.resumeText.trim() ? 0.6 : 1,
          }}
        >
          {state.parsing ? '◎ PARSING…' : '↻ PARSE PROFILE'}
        </button>
        <p style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', lineHeight: 1.7, margin: '11px 2px 0' }}>
          Parsed server-side, heuristically. Everything below is a hint you confirm or edit — it never
          overrides your judgment.
        </p>
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        {state.parsed ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                flexWrap: 'wrap',
                background: 'var(--rr-primary-tint)',
                border: '1px solid #C5DDCB',
                borderRadius: 9,
                padding: '11px 14px',
                marginBottom: 20,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: '#0F6B3B', letterSpacing: '0.04em' }}>
                ✓ PARSED
              </span>
              <span style={{ fontSize: 12.5, color: '#3A6B49', flex: 1, minWidth: 220 }}>
                {strengths.length} strengths ·{' '}
                {state.termGroups.reduce((n, g) => n + g.terms.length, 0)} range terms in{' '}
                {state.termGroups.filter((g) => g.terms.length > 0).length} groups ·{' '}
                {state.watchlist.length} companies watched.
              </span>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'search' })}
                style={{
                  border: '1px solid #C5DDCB',
                  background: 'var(--rr-surface)',
                  color: '#0F6B3B',
                  cursor: 'pointer',
                  padding: '5px 12px',
                  borderRadius: 7,
                  fontFamily: MONO,
                  fontSize: 10.5,
                  fontWeight: 600,
                  flex: '0 0 auto',
                }}
              >
                Review Range →
              </button>
            </div>

            <SectionLabel style={{ letterSpacing: '0.06em', marginBottom: 4 }}>YOUR STRENGTHS</SectionLabel>
            <div style={{ fontSize: 12.5, color: '#7A7468', marginBottom: 13 }}>
              This is exactly what every fit score is measured against. Adjust the weights to tune your
              rankings.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 24 }}>
              {strengths.map((st) => {
                const conf = CONF_VM[st.conf];
                const weight = state.weights[st.key] ?? st.weight;
                return (
                  <div
                    key={st.key}
                    style={{
                      background: 'var(--rr-surface)',
                      border: '1px solid var(--rr-border)',
                      borderRadius: 10,
                      padding: '13px 15px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--rr-ink)' }}>{st.label}</span>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 9.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 5,
                          background: conf.bg,
                          color: conf.color,
                          border: `1px solid ${conf.bd}`,
                          letterSpacing: '0.03em',
                        }}
                      >
                        {conf.label}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: MONO, fontSize: 9.5, color: '#A39C8B' }}>WEIGHT</span>
                      <button
                        onClick={() => dispatch({ type: 'CYCLE_WEIGHT', key: st.key, base: st.weight })}
                        title="click to change weight"
                        style={{
                          display: 'flex',
                          gap: 3,
                          alignItems: 'center',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: i < weight ? conf.bar : '#E0DBCF',
                            }}
                          />
                        ))}
                      </button>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: '#EBE6DB',
                        borderRadius: 4,
                        overflow: 'hidden',
                        margin: '11px 0 10px',
                      }}
                    >
                      <div style={{ height: '100%', width: `${st.bar}%`, background: conf.bar, borderRadius: 4 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 9,
                          color: '#B0A899',
                          flex: '0 0 auto',
                          paddingTop: 1,
                          letterSpacing: '0.04em',
                        }}
                      >
                        RÉSUMÉ
                      </span>
                      <span style={{ fontSize: 12, color: '#7A7468', lineHeight: 1.5, fontStyle: 'italic' }}>
                        “{st.ev}”
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <SectionLabel style={{ letterSpacing: '0.06em', marginBottom: 11 }}>
              SUGGESTED SEARCH TERMS — FROM YOUR RÉSUMÉ
            </SectionLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {sugTerms.map((t) => {
                const added = t.added || state.profileTermsAdded[t.label];
                return (
                  <button
                    key={t.label}
                    onClick={() => dispatch({ type: 'ADD_PROFILE_TERM', label: t.label })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      fontFamily: MONO,
                      fontSize: 11.5,
                      padding: '6px 11px',
                      borderRadius: 8,
                      background: added ? 'var(--rr-primary-tint)' : 'var(--rr-surface)',
                      color: added ? '#0F6B3B' : 'var(--rr-muted)',
                      border: `1px solid ${added ? '#C5DDCB' : 'var(--rr-border)'}`,
                    }}
                  >
                    {t.label}
                    <span style={{ fontSize: 9.5, opacity: 0.85 }}>{added ? '✓ in search' : '+ add'}</span>
                  </button>
                );
              })}
            </div>

            <SectionLabel style={{ letterSpacing: '0.06em', marginBottom: 11 }}>
              SUGGESTED WATCHLIST — INFERRED FROM YOUR PROFILE
            </SectionLabel>
            <div
              style={{
                background: 'var(--rr-surface)',
                border: '1px solid var(--rr-border)',
                borderRadius: 10,
                padding: '7px 8px',
                marginBottom: 24,
              }}
            >
              {sugCos.map((c) => {
                const added = state.profileCosAdded[c.name];
                return (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rr-ink)' }}>{c.name}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--rr-faint)', marginTop: 2 }}>
                        {c.reason}
                      </div>
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'ADD_PROFILE_CO', name: c.name })}
                      style={{
                        border: `1px solid ${added ? '#C5DDCB' : 'var(--rr-border)'}`,
                        background: added ? 'var(--rr-primary-tint)' : 'var(--rr-surface)',
                        color: added ? '#0F6B3B' : 'var(--rr-muted)',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        borderRadius: 7,
                        fontFamily: MONO,
                        fontSize: 10.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {added ? '✓ on watchlist' : '+ watch'}
                    </button>
                  </div>
                );
              })}
            </div>

            {facts && (
              <>
                <SectionLabel style={{ letterSpacing: '0.06em', marginBottom: 11 }}>
                  PROFILE FACTS — SET YOUR DEFAULTS
                </SectionLabel>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {facts.seniority && (
                    <div style={factCardStyle}>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', letterSpacing: '0.05em' }}>
                        SENIORITY
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--rr-ink)', marginTop: 5 }}>
                        {facts.seniority}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#7A7468', marginTop: 3 }}>
                        Used by the level-fit dimension.
                      </div>
                    </div>
                  )}
                  <div style={factCardStyle}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', letterSpacing: '0.05em' }}>
                      LOCATION → ELIGIBILITY
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--rr-ink)' }}>
                        {facts.location ?? '—'}
                      </span>
                      {facts.canadaEligible && (
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 9.5,
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: 'var(--rr-primary-tint)',
                            color: '#0F6B3B',
                            border: '1px solid #C5DDCB',
                          }}
                        >
                          CANADA ✓
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#7A7468', marginTop: 3 }}>
                      Canada-eligible filter on by default.
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ border: '1px dashed #DCD6C9', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, color: '#C4BCAC', marginBottom: 10 }}>◈</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#3A352D' }}>
              {strengths.length === 0 && !state.resumeText.trim()
                ? 'Your profile starts here'
                : 'Résumé edited — re-parse to refresh'}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--rr-faint)', maxWidth: 340, margin: '8px auto 0', lineHeight: 1.55 }}>
              {strengths.length === 0 && !state.resumeText.trim() ? (
                <>
                  Paste your résumé on the left and hit <b>Parse profile</b>. Radar extracts your
                  strengths, suggests search terms and companies, and scores every role against this
                  text.
                </>
              ) : (
                <>
                  Hit <b>Parse profile</b> to re-extract strengths, terms and watchlist suggestions
                  from your updated text.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const factCardStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  background: 'var(--rr-surface)',
  border: '1px solid var(--rr-border)',
  borderRadius: 10,
  padding: '13px 15px',
};
