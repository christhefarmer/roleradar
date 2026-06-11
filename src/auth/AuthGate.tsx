// Auth gate — sign in / create account / 6-digit confirm / forgot, on a
// centered floating card. Mock flow for now; production swaps the handlers
// for Amplify Auth (Cognito): signIn, signUp, confirmSignUp, resetPassword.

import { useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { MONO } from '../ui/primitives';

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid var(--rr-border)',
  background: '#FFFDF9',
  borderRadius: 9,
  padding: '11px 13px',
  fontSize: 14,
  color: 'var(--rr-ink)',
  outline: 'none',
};

const primaryBtnStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  cursor: 'pointer',
  padding: 12,
  borderRadius: 9,
  color: '#fff',
  fontFamily: MONO,
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: '0.04em',
  boxShadow: '0 1px 0 #15623A',
};

const linkBtnStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--rr-primary)',
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 600,
  padding: 0,
};

function FieldLabel({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: '#A39C8B', letterSpacing: '0.06em', flex: 1 }}>
        {children}
      </span>
      {trailing}
    </div>
  );
}

export function AuthGate() {
  const { state, dispatch } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const mode = state.authMode;
  const setMode = (m: typeof mode) => {
    setResetMsg('');
    dispatch({ type: 'SET_AUTH_MODE', mode: m });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: '#F1EEE6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'IBM Plex Sans', sans-serif",
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 406 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 22 }}>
          {/* Brand mark: the radar diamond — a 45°-rotated square with a green dot */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              border: '1.5px solid var(--rr-ink)',
              borderRadius: 6,
              transform: 'rotate(45deg)',
            }}
          >
            <span style={{ width: 8, height: 8, background: 'var(--rr-primary)', borderRadius: 1 }} />
          </span>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 16, letterSpacing: '0.14em' }}>
            ROLE&nbsp;RADAR
          </span>
        </div>

        <div
          style={{
            background: 'var(--rr-surface)',
            border: '1px solid var(--rr-border)',
            borderRadius: 16,
            padding: '30px 28px',
            boxShadow: '0 8px 40px rgba(33,30,24,0.07)',
          }}
        >
          {mode === 'signin' && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--rr-ink)' }}>Sign in to your cockpit</div>
              <div style={{ fontSize: 13, color: '#7A7468', marginTop: 5, marginBottom: 22 }}>
                Your private job-hunt instrument.
              </div>
              <FieldLabel>EMAIL</FieldLabel>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                style={{ ...inputStyle, marginBottom: 16 }}
              />
              <FieldLabel
                trailing={
                  <button
                    onClick={() => setMode('forgot')}
                    style={{ ...linkBtnStyle, fontSize: 11, fontFamily: MONO, fontWeight: 400 }}
                  >
                    forgot?
                  </button>
                }
              >
                PASSWORD
              </FieldLabel>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                style={{ ...inputStyle, marginBottom: 20 }}
              />
              <button
                onClick={() => dispatch({ type: 'SIGN_IN', email })}
                className="rr-btn-primary"
                style={primaryBtnStyle}
              >
                Sign in →
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <span style={{ flex: 1, height: 1, background: '#E8E4DA' }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#B0A899' }}>OR</span>
                <span style={{ flex: 1, height: 1, background: '#E8E4DA' }} />
              </div>
              <button
                onClick={() => dispatch({ type: 'SIGN_IN', email })}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  border: '1px solid var(--rr-border)',
                  background: '#FFFDF9',
                  cursor: 'pointer',
                  padding: 11,
                  borderRadius: 9,
                  color: '#3A352D',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--rr-hairline)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: MONO,
                    fontSize: 11,
                    color: 'var(--rr-muted)',
                  }}
                >
                  G
                </span>
                Continue with Google
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: '#7A7468' }}>
                New here?{' '}
                <button onClick={() => setMode('signup')} style={linkBtnStyle}>
                  Create an account
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--rr-ink)' }}>Create your account</div>
              <div style={{ fontSize: 13, color: '#7A7468', marginTop: 5, marginBottom: 22 }}>
                Set up your own cockpit in under a minute.
              </div>
              <FieldLabel>DISPLAY NAME</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Specialist"
                style={{ ...inputStyle, marginBottom: 16 }}
              />
              <FieldLabel>EMAIL</FieldLabel>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                style={{ ...inputStyle, marginBottom: 16 }}
              />
              <FieldLabel>PASSWORD</FieldLabel>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="8+ characters"
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ fontSize: 11, color: 'var(--rr-faint)', marginBottom: 20 }}>
                At least 8 characters with a number — enforced by Cognito.
              </div>
              <button onClick={() => setMode('confirm')} className="rr-btn-primary" style={primaryBtnStyle}>
                Create account →
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: '#7A7468' }}>
                Have an account?{' '}
                <button onClick={() => setMode('signin')} style={linkBtnStyle}>
                  Sign in
                </button>
              </div>
            </>
          )}

          {mode === 'confirm' && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--rr-ink)' }}>Check your email</div>
              <div style={{ fontSize: 13, color: '#7A7468', marginTop: 5, marginBottom: 22, lineHeight: 1.55 }}>
                We sent a 6-digit code to <b style={{ color: '#3A352D' }}>{email || 'your email'}</b>. Enter
                it to verify your account.
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                placeholder="••••••"
                style={{
                  ...inputStyle,
                  padding: 14,
                  fontFamily: MONO,
                  fontSize: 24,
                  letterSpacing: '0.45em',
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              />
              <button
                onClick={() => dispatch({ type: 'VERIFY', name, email })}
                className="rr-btn-primary"
                style={primaryBtnStyle}
              >
                Verify &amp; enter →
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: '#7A7468' }}>
                Didn't get it?{' '}
                <button onClick={() => setMode('confirm')} style={linkBtnStyle}>
                  Resend code
                </button>{' '}
                ·{' '}
                <button
                  onClick={() => setMode('signin')}
                  style={{ ...linkBtnStyle, color: 'var(--rr-faint)', fontWeight: 400 }}
                >
                  Back
                </button>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--rr-ink)' }}>Reset your password</div>
              <div style={{ fontSize: 13, color: '#7A7468', marginTop: 5, marginBottom: 22 }}>
                Enter your email and we'll send a reset link.
              </div>
              <FieldLabel>EMAIL</FieldLabel>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                style={{ ...inputStyle, marginBottom: 16 }}
              />
              {resetMsg && (
                <div
                  style={{
                    background: 'var(--rr-primary-tint)',
                    border: '1px solid #C5DDCB',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    color: '#0F6B3B',
                    marginBottom: 16,
                  }}
                >
                  {resetMsg}
                </div>
              )}
              <button
                onClick={() => setResetMsg('If that email has an account, a reset link is on its way.')}
                className="rr-btn-primary"
                style={primaryBtnStyle}
              >
                Send reset link
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5 }}>
                <button
                  onClick={() => setMode('signin')}
                  style={{ ...linkBtnStyle, color: 'var(--rr-faint)', fontWeight: 400 }}
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 16,
            fontFamily: MONO,
            fontSize: 10,
            color: '#A39C8B',
            letterSpacing: '0.03em',
          }}
        >
          Secured by AWS Cognito · Amplify Gen 2
        </div>
      </div>
    </div>
  );
}
