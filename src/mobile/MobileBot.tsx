// The mobile PWA experience — roleradar.bot opens straight into Radar:
// launch splash → live scanning sweep → conversational briefing (greeting,
// sweep summary, featured match, approval cards, quick replies, chat), with
// the full-cockpit escape hatch as a bottom sheet.
//
// Production wiring: the sweep animation tracks the real async sweep job via
// an AppSync subscription (not a fixed timer), and the chat streams from the
// AI Kit conversation route.

import { useCallback, useEffect, useRef, useState } from 'react';
import { botReply } from '../data/botReplies';
import { FEATURED_MATCH, MOBILE_PROPOSALS, MOBILE_SWEEP } from '../data/seed';
import type { ChatMessage, ViewKey } from '../domain/types';
import { useStore } from '../state/store';
import { HatGlasses, RadarAvatar } from '../ui/HatGlasses';
import { MONO } from '../ui/primitives';
import { proposalTone } from '../ui/tones';

type Phase = 'splash' | 'sweep' | 'brief';

const COCKPIT_LINKS: { glyph: string; label: string; view: ViewKey }[] = [
  { glyph: '◆', label: 'Recommended', view: 'recommend' },
  { glyph: '◇', label: 'Hidden gems', view: 'gems' },
  { glyph: '▤', label: 'Pipeline', view: 'pipeline' },
  { glyph: '≋', label: 'Search & watchlist', view: 'search' },
  { glyph: '◈', label: 'Profile', view: 'profile' },
];

const QUICK_REPLIES = ['Show all matches', "What's new?", 'Any phantoms?', 'Hidden gems'];

const INITIAL_CHAT: ChatMessage[] = [
  { role: 'bot', text: "Good morning. I sent my scouts out while you were away — here's what they brought back." },
  { role: 'bot', text: '23 roles kept · 2 phantoms muted · 3 hidden gems found.' },
  { role: 'bot', text: 'Your strongest new match:' },
  { role: 'match' },
  { role: 'bot', text: "I'd also make a few changes to widen your net — your call:" },
  { role: 'proposals' },
];

export function MobileBot({ onOpenCockpit }: { onOpenCockpit: (view: ViewKey) => void }) {
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<Phase>('splash');
  const [sweepDone, setSweepDone] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [input, setInput] = useState('');
  const sweeping = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const runSweep = useCallback(() => {
    if (sweeping.current) return;
    sweeping.current = true;
    setPhase('sweep');
    setSweepDone(0);
    let i = 0;
    const step = () => {
      i++;
      setSweepDone(i);
      if (i < MOBILE_SWEEP.length) setTimeout(step, 430);
      else
        setTimeout(() => {
          sweeping.current = false;
          setPhase('brief');
        }, 700);
    };
    setTimeout(step, 550);
  }, []);

  useEffect(() => {
    const t = setTimeout(runSweep, 1100);
    return () => clearTimeout(t);
  }, [runSweep]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t) return;
    setChat((c) => [...c, { role: 'user', text: t }, { role: 'bot', text: botReply(t, true) }]);
    setInput('');
  };

  if (phase === 'splash') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--rr-primary)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 30px',
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 23,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 14px 40px rgba(0,0,0,0.25)',
            }}
          >
            <HatGlasses size={54} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 21, fontWeight: 600, letterSpacing: '0.12em', color: '#fff', marginTop: 22 }}>
            RADAR
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 7, letterSpacing: '0.02em' }}>
            roleradar.bot
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 30 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
              waking your scout…
            </span>
          </div>
        </div>
        <div style={{ padding: '0 30px 42px', textAlign: 'center', flex: '0 0 auto' }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}>
            INSTALLED · STANDALONE PWA
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100dvh',
        background: 'var(--rr-paper)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '13px 18px',
          borderBottom: '1px solid #E2DDD1',
          flex: '0 0 auto',
          background: 'var(--rr-paper)',
        }}
      >
        <RadarAvatar size={36} iconSize={21} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--rr-ink)' }}>
            RADAR
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: phase === 'sweep' ? '#C39237' : 'var(--rr-primary)',
                flex: '0 0 auto',
              }}
            />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: '#8A8475',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {phase === 'sweep' ? 'scouts on patrol…' : 'on · scouts back just now'}
            </span>
          </div>
        </div>
        <button onClick={runSweep} title="Re-run sweep" style={headerBtnStyle}>
          ↻
        </button>
        <button onClick={() => setSheetOpen(true)} title="Full cockpit" style={headerBtnStyle}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#6E685D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
      </div>

      {phase === 'sweep' ? (
        /* live sweep — radar circle + sources lighting up */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 28px',
            background: 'var(--rr-paper)',
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: '50%',
              border: '1px solid #E0DBCF',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ position: 'absolute', inset: 15, borderRadius: '50%', border: '1px solid #EAE5D9' }} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, rgba(30,138,79,0.30), rgba(30,138,79,0) 90deg)',
                animation: 'radarsweep 1.5s linear infinite',
              }}
            />
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                background: 'var(--rr-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 0 0 7px var(--rr-paper)',
              }}
            >
              <HatGlasses size={27} stroke="#fff" />
            </span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: '#3A352D', letterSpacing: '0.05em', marginTop: 24 }}>
            SCOUTS ON PATROL…
          </div>
          <div style={{ width: '100%', maxWidth: 248, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOBILE_SWEEP.map((s, idx) => {
              const done = idx < sweepDone;
              const scanning = idx === sweepDone;
              return (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: done ? 'var(--rr-primary)' : scanning ? '#C39237' : '#D8D3C8',
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 12, color: done || scanning ? '#3A352D' : '#A39C8B' }}>
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: done ? '#0F6B3B' : scanning ? '#8A5E14' : '#B0A899',
                    }}
                  >
                    {done ? `✓ ${s.count} roles` : scanning ? 'scanning…' : 'queued'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* briefing chat */}
          <div
            ref={chatRef}
            data-rr="mchat"
            style={{ flex: 1, overflowY: 'auto', padding: 15, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {chat.map((m, i) => {
              if (m.role === 'bot')
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        width: 23,
                        height: 23,
                        borderRadius: 7,
                        background: 'var(--rr-primary-tint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: '0 0 auto',
                        marginTop: 1,
                      }}
                    >
                      <HatGlasses size={14} strokeWidth={2.2} />
                    </span>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'var(--rr-surface)',
                        border: '1px solid var(--rr-border)',
                        borderRadius: '3px 13px 13px 13px',
                        padding: '11px 13px',
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        color: '#3A352D',
                        textWrap: 'pretty',
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              if (m.role === 'match')
                return (
                  <div
                    key={i}
                    style={{
                      marginLeft: 31,
                      background: 'var(--rr-surface)',
                      border: '1px solid var(--rr-border)',
                      borderLeft: '3px solid var(--rr-primary)',
                      borderRadius: 12,
                      padding: '13px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--rr-ink)', lineHeight: 1.25 }}>
                        {FEATURED_MATCH.title}
                      </span>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 5,
                          background: 'var(--rr-primary-tint)',
                          color: '#0F6B3B',
                          border: '1px solid #C5DDCB',
                          flex: '0 0 auto',
                        }}
                      >
                        CA ✓
                      </span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: '#8A8475', marginTop: 4 }}>
                      {FEATURED_MATCH.meta}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'var(--rr-primary-tint)',
                          color: '#0F6B3B',
                          border: '1px solid #C5DDCB',
                        }}
                      >
                        MATCH
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: '#0F6B3B' }}>
                        {FEATURED_MATCH.score}
                        <span style={{ fontSize: 9, color: '#B8B0A0' }}>/100</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {FEATURED_MATCH.reasons.map((r) => (
                        <span
                          key={r}
                          style={{
                            fontFamily: MONO,
                            fontSize: 10,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'var(--rr-primary-tint)',
                            color: '#0F6B3B',
                            border: '1px solid #C5DDCB',
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 7, marginTop: 13 }}>
                      <button
                        onClick={() => dispatch({ type: 'ADD_TO_PIPE', id: 'onepass' })}
                        className="rr-btn-primary"
                        style={{
                          flex: 1,
                          border: 'none',
                          cursor: 'pointer',
                          padding: 9,
                          borderRadius: 8,
                          color: '#fff',
                          fontFamily: MONO,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Save to pipeline
                      </button>
                      <button
                        onClick={() => send('Why is 1Password a match?')}
                        style={{
                          border: '1px solid #E2DDD1',
                          background: 'var(--rr-surface)',
                          color: '#3A352D',
                          cursor: 'pointer',
                          padding: '9px 14px',
                          borderRadius: 8,
                          fontFamily: MONO,
                          fontSize: 11,
                        }}
                      >
                        Why?
                      </button>
                    </div>
                  </div>
                );
              if (m.role === 'proposals')
                return (
                  <div key={i} style={{ marginLeft: 31, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {MOBILE_PROPOSALS.map((p) => {
                      const st = state.proposalState[p.id];
                      const tone = proposalTone(p.tone);
                      return (
                        <div
                          key={p.id}
                          style={{
                            background: 'var(--rr-surface)',
                            border: '1px solid var(--rr-border)',
                            borderLeft: `3px solid ${tone.accent}`,
                            borderRadius: 10,
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
                              letterSpacing: '0.04em',
                            }}
                          >
                            {p.kind}
                          </span>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--rr-ink)', marginTop: 7 }}>
                            {p.title}
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#7A7468', lineHeight: 1.5 }}>
                            {p.rationale}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
                            {!st ? (
                              <>
                                <button
                                  onClick={() => dispatch({ type: 'APPROVE_PROPOSAL', id: p.id })}
                                  className="rr-btn-primary"
                                  style={{
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '7px 13px',
                                    borderRadius: 7,
                                    color: '#fff',
                                    fontFamily: MONO,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                  }}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => dispatch({ type: 'DISMISS_PROPOSAL', id: p.id })}
                                  style={{
                                    border: '1px solid #E2DDD1',
                                    background: 'transparent',
                                    color: 'var(--rr-faint)',
                                    cursor: 'pointer',
                                    padding: '7px 13px',
                                    borderRadius: 7,
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
                                {st === 'approved' ? `✓ ${p.ok}` : '— Dismissed'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      maxWidth: '80%',
                      background: 'var(--rr-primary)',
                      color: '#fff',
                      borderRadius: '13px 3px 13px 13px',
                      padding: '10px 13px',
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* quick replies */}
          <div
            data-rr="qr"
            style={{
              padding: '0 13px 9px',
              display: 'flex',
              gap: 7,
              overflowX: 'auto',
              flex: '0 0 auto',
              background: 'var(--rr-paper)',
            }}
          >
            {QUICK_REPLIES.map((label) => (
              <button
                key={label}
                onClick={() => send(label)}
                style={{
                  whiteSpace: 'nowrap',
                  border: '1px solid var(--rr-border)',
                  background: 'var(--rr-surface)',
                  color: '#5E594E',
                  cursor: 'pointer',
                  padding: '7px 12px',
                  borderRadius: 16,
                  fontSize: 11.5,
                  flex: '0 0 auto',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* input — ≥44px touch targets */}
          <div
            style={{
              padding: '10px 14px calc(14px + env(safe-area-inset-bottom))',
              borderTop: '1px solid #E2DDD1',
              display: 'flex',
              gap: 8,
              flex: '0 0 auto',
              background: 'var(--rr-paper)',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="Ask Radar anything…"
              style={{
                flex: 1,
                border: '1px solid var(--rr-border)',
                background: 'var(--rr-surface)',
                borderRadius: 20,
                padding: '11px 15px',
                fontSize: 13.5,
                color: 'var(--rr-ink)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => send()}
              className="rr-btn-primary"
              style={{
                width: 44,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 22,
                color: '#fff',
                fontSize: 16,
                flex: '0 0 auto',
              }}
            >
              ↑
            </button>
          </div>
        </>
      )}

      {/* escape hatch: full cockpit bottom sheet */}
      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 55,
            background: 'rgba(26,24,19,0.4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--rr-paper)',
              borderRadius: '24px 24px 0 0',
              padding: '10px 16px calc(30px + env(safe-area-inset-bottom))',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.22)',
            }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 3, background: '#D8D3C8', margin: '4px auto 14px' }} />
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: '#A39C8B', letterSpacing: '0.06em', margin: '0 2px 4px' }}>
              OPEN THE FULL COCKPIT
            </div>
            <div style={{ fontSize: 12.5, color: '#7A7468', margin: '0 2px 14px', lineHeight: 1.5 }}>
              Radar handles the day-to-day. The cockpit has every detail when you want to dig in.
            </div>
            {COCKPIT_LINKS.map((c) => (
              <button
                key={c.view}
                onClick={() => {
                  setSheetOpen(false);
                  onOpenCockpit(c.view);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--rr-surface)',
                  border: '1px solid var(--rr-border)',
                  borderRadius: 11,
                  padding: '12px 13px',
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'var(--rr-panel)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: MONO,
                    fontSize: 13,
                    color: 'var(--rr-primary)',
                    flex: '0 0 auto',
                  }}
                >
                  {c.glyph}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--rr-ink)' }}>{c.label}</span>
                <span style={{ color: '#C4BCAC', fontSize: 15 }}>›</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  background: 'var(--rr-panel)',
  border: '1px solid #E2DDD1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--rr-muted)',
  fontSize: 14,
  cursor: 'pointer',
  flex: '0 0 auto',
};
