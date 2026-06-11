// Auth gate — sign in / create account / 6-digit confirm / forgot, on a
// centered floating card. Connected mode drives real Cognito flows through
// the store api; design-fidelity mode passes straight through.

import { useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { MONO } from '../ui/primitives';
import { AuthStep } from './authService';

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

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      style={{
        background: 'var(--rr-risk-tint)',
        border: '1px solid #E6CBBE',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12.5,
        color: 'var(--rr-risk-strong)',
        marginBottom: 16,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

export function AuthGate() {
  const { state, dispatch, api } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [resetStage, setResetStage] = useState<'email' | 'code'>('email');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mode = state.authMode;
  const setMode = (m: typeof mode) => {
    setError('');
    setNotice('');
    setResetStage('email');
    dispatch({ type: 'SET_AUTH_MODE', mode: m });
  };

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    fn()
      .catch((e: unknown) => {
        if (e instanceof AuthStep && e.step === 'confirm') {
          setNotice('Your account still needs its email code — we sent a fresh one.');
          dispatch({ type: 'SET_AUTH_MODE', mode: 'confirm' });
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setBusy(false));
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
            opacity: busy ? 0.75 : 1,
          }}
        >
          {mode === 'signin' && (
            <>
              <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--rr-ink)' }}>Sign in to your cockpit</div>
              <div style={{ fontSize: 13, color: '#7A7468', marginTop: 5, marginBottom: 22 }}>
                Your private job-hunt instrument.
              </div>
              <ErrorNote message={error} />
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') run(() => api.signIn(email, password));
                }}
                type="password"
                placeholder="••••••••"
                style={{ ...inputStyle, marginBottom: 20 }}
              />
              <button
                onClick={() => run(() => api.signIn(email, password))}
                disabled={busy}
                className="rr-btn-primary"
                style={primaryBtnStyle}
              >
                {busy ? 'Signing in…' : 'Sign in →'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                <span style={{ flex: 1, height: 1, background: '#E8E4DA' }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#B0A899' }}>OR</span>
                <span style={{ flex: 1, height: 1, background: '#E8E4DA' }} />
              </div>
              <button
                onClick={() =>
                  state.connected
                    ? setError('Google sign-in is not configured yet — use email & password.')
                    : run(() => api.signIn(email, password))
                }
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
              <ErrorNote message={error} />
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
              <button
                onClick={() =>
                  run(async () => {
                    await api.signUp(name, email, password);
                    dispatch({ type: 'SET_AUTH_MODE', mode: 'confirm' });
                  })
                }
                disabled={busy}
                className="rr-btn-primary"
                style={primaryBtnStyle}
              >
                {busy ? 'Creating…' : 'Create account →'}
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
              <ErrorNote message={error} />
              {notice && (
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
                  {notice}
                </div>
              )}
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
                onClick={() => run(() => api.confirm(name, email, code, password))}
                disabled={busy}
                className="rr-btn-primary"
                style={primaryBtnStyle}
              >
                {busy ? 'Verifying…' : 'Verify & enter →'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: '#7A7468' }}>
                Didn't get it?{' '}
                <button
                  onClick={() =>
                    run(async () => {
                      await api.resendCode(email);
                      setNotice('A fresh code is on its way.');
                    })
                  }
                  style={linkBtnStyle}
                >
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
                {resetStage === 'email'
                  ? "Enter your email and we'll send a reset code."
                  : 'Enter the code from your email and choose a new password.'}
              </div>
              <ErrorNote message={error} />
              {notice && (
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
                  {notice}
                </div>
              )}
              {resetStage === 'email' ? (
                <>
                  <FieldLabel>EMAIL</FieldLabel>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    style={{ ...inputStyle, marginBottom: 16 }}
                  />
                  <button
                    onClick={() =>
                      run(async () => {
                        await api.startReset(email);
                        setNotice('If that email has an account, a reset code is on its way.');
                        if (state.connected) setResetStage('code');
                      })
                    }
                    disabled={busy}
                    className="rr-btn-primary"
                    style={primaryBtnStyle}
                  >
                    {busy ? 'Sending…' : 'Send reset code'}
                  </button>
                </>
              ) : (
                <>
                  <FieldLabel>CODE</FieldLabel>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="••••••"
                    style={{ ...inputStyle, fontFamily: MONO, letterSpacing: '0.3em', marginBottom: 16 }}
                  />
                  <FieldLabel>NEW PASSWORD</FieldLabel>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="8+ characters"
                    style={{ ...inputStyle, marginBottom: 20 }}
                  />
                  <button
                    onClick={() =>
                      run(async () => {
                        await api.confirmReset(email, code, newPassword);
                        setNotice('');
                        setCode('');
                        setMode('signin');
                      })
                    }
                    disabled={busy}
                    className="rr-btn-primary"
                    style={primaryBtnStyle}
                  >
                    {busy ? 'Resetting…' : 'Set new password →'}
                  </button>
                </>
              )}
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
