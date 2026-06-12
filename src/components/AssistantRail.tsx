// The Radar assistant rail — persistent right rail (collapsible to a
// launcher). Bot greeting, grounded replies, suggested prompts, the approval
// queue, and a chat input. Production: messages stream from the Amplify AI
// Kit conversation route via useAIConversation; the approval queue stays —
// it is the human-in-the-loop gate for every write tool.

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { HatGlasses, RadarAvatar } from '../ui/HatGlasses';
import { MONO } from '../ui/primitives';
import { ProposalCard } from './ProposalCard';

const PROMPTS = [
  'Walk me through my top matches',
  "What's new this sweep?",
  'Review my proposals',
  'Explain a phantom',
];

export function AssistantRail() {
  const { state, dispatch, api } = useStore();
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  const lastLen = state.chat[state.chat.length - 1]?.text?.length ?? 0;
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.chat.length, lastLen]);

  const queue = state.proposals.filter((p) => !state.proposalState[p.id]).length;

  if (!state.assistantOpen) {
    return (
      <button
        onClick={() => dispatch({ type: 'TOGGLE_ASSISTANT' })}
        style={{
          position: 'fixed',
          right: 22,
          bottom: 22,
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          border: 'none',
          cursor: 'pointer',
          padding: '13px 19px',
          borderRadius: 30,
          background: 'var(--rr-primary)',
          color: '#fff',
          boxShadow: '0 6px 24px rgba(30,138,79,0.34)',
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.03em',
        }}
      >
        <HatGlasses size={16} stroke="#fff" />
        Ask Radar
        {queue > 0 && (
          <span
            style={{
              background: '#fff',
              color: '#0F6B3B',
              fontSize: 10,
              minWidth: 17,
              textAlign: 'center',
              padding: '1px 5px',
              borderRadius: 9,
            }}
          >
            {queue}
          </span>
        )}
      </button>
    );
  }

  const send = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || state.chatBusy) return;
    api.sendChat(t);
    setInput('');
  };

  return (
    <aside
      data-rr="rail"
      style={{
        width: 362,
        flex: '0 0 362px',
        background: 'var(--rr-panel)',
        borderLeft: '1px solid #E2DDD1',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '15px 17px',
          borderBottom: '1px solid #E2DDD1',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          flex: '0 0 auto',
        }}
      >
        <RadarAvatar size={32} iconSize={18} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--rr-ink)',
            }}
          >
            RADAR
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_ASSISTANT' })}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#A39C8B',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      <div
        ref={chatRef}
        data-rr="chat"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
          minHeight: 0,
        }}
      >
        {state.chat.map((m, i) =>
          m.role === 'bot' ? (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 24,
                  height: 24,
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    background: m.error ? 'var(--rr-risk-tint)' : 'var(--rr-surface)',
                    border: `1px solid ${m.error ? '#E6CBBE' : 'var(--rr-border)'}`,
                    borderLeft: m.error ? '3px solid var(--rr-risk)' : undefined,
                    borderRadius: '3px 12px 12px 12px',
                    padding: '11px 13px',
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: m.error ? 'var(--rr-risk-strong)' : '#3A352D',
                    textWrap: 'pretty',
                  }}
                >
                  {m.text ||
                    (state.chatBusy ? (
                      <span style={{ fontFamily: MONO, color: '#A39C8B' }}>scouts reasoning…</span>
                    ) : (
                      '…'
                    ))}
                </div>
                {m.showProposals && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {state.proposals.map((p) => (
                      <ProposalCard key={p.id} proposal={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  maxWidth: '82%',
                  background: 'var(--rr-primary-tint)',
                  border: '1px solid #C5DDCB',
                  borderRadius: '12px 3px 12px 12px',
                  padding: '10px 13px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#1F4A32',
                }}
              >
                {m.text}
              </div>
            </div>
          ),
        )}
      </div>

      <div
        style={{ padding: '0 14px 10px', display: 'flex', gap: 7, flexWrap: 'wrap', flex: '0 0 auto' }}
      >
        {PROMPTS.map((label) => (
          <button
            key={label}
            onClick={() => send(label)}
            style={{
              border: '1px solid var(--rr-border)',
              background: 'var(--rr-surface)',
              color: '#5E594E',
              cursor: 'pointer',
              padding: '6px 11px',
              borderRadius: 16,
              fontSize: 11.5,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: '11px 14px',
          borderTop: '1px solid #E2DDD1',
          display: 'flex',
          gap: 8,
          flex: '0 0 auto',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Ask about your roles…"
          style={{
            flex: 1,
            border: '1px solid var(--rr-border)',
            background: 'var(--rr-surface)',
            borderRadius: 9,
            padding: '10px 13px',
            fontSize: 13,
            color: 'var(--rr-ink)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => send()}
          className="rr-btn-primary"
          style={{
            width: 40,
            border: 'none',
            cursor: 'pointer',
            borderRadius: 9,
            color: '#fff',
            fontSize: 15,
            flex: '0 0 auto',
          }}
        >
          ↑
        </button>
      </div>
    </aside>
  );
}
