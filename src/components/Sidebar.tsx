// Sidebar nav (panel). Order is product-intent: Scouts · Hidden Gems ·
// Recommended · Search · Pipeline; Profile is reached only via the user menu.

import { useState } from 'react';
import { GEMS } from '../data/seed';
import type { ViewKey } from '../domain/types';
import { useStore } from '../state/store';
import { HatGlasses } from '../ui/HatGlasses';
import { MONO } from '../ui/primitives';

const NAV: { key: ViewKey; label: string; glyph: string }[] = [
  { key: 'radar', label: 'SCOUTS', glyph: '◎' },
  { key: 'gems', label: 'HIDDEN GEMS', glyph: '◇' },
  { key: 'recommend', label: 'RECOMMENDED', glyph: '◆' },
  { key: 'search', label: 'SEARCH', glyph: '≋' },
  { key: 'pipeline', label: 'PIPELINE', glyph: '▤' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'RR';
  return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : parts[0][1] || '')).toUpperCase();
}

export function Sidebar() {
  const { state, dispatch } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const gemOpen = GEMS.filter((g) => !state.gemDecisions[g.id]).length;
  const queue = state.proposals.filter((p) => !state.proposalState[p.id]).length;
  const badges: Partial<Record<ViewKey, number>> = { radar: queue, gems: gemOpen };

  return (
    <aside
      data-rr="side"
      style={{
        width: 238,
        flex: '0 0 238px',
        background: 'var(--rr-panel)',
        borderRight: '1px solid #E2DDD1',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
      }}
    >
      <div
        data-rr="brand"
        style={{ padding: '4px 8px 18px', borderBottom: '1px solid #E2DDD1', marginBottom: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HatGlasses />
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 15, letterSpacing: '0.14em' }}>
            ROLE&nbsp;RADAR
          </span>
        </div>
      </div>

      <nav data-rr="nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {NAV.map((n) => {
          const active = state.view === n.key;
          const badge = badges[n.key];
          return (
            <button
              key={n.key}
              onClick={() => dispatch({ type: 'SET_VIEW', view: n.key })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                cursor: 'pointer',
                padding: '9px 11px',
                borderRadius: 7,
                fontFamily: MONO,
                fontSize: 11.5,
                letterSpacing: '0.07em',
                background: active ? 'var(--rr-surface)' : 'transparent',
                color: active ? 'var(--rr-ink)' : 'var(--rr-muted)',
                transition: 'background .12s',
              }}
            >
              <span
                style={{
                  width: 15,
                  textAlign: 'center',
                  fontSize: 12,
                  color: active ? 'var(--rr-primary)' : '#B0A899',
                }}
              >
                {n.glyph}
              </span>
              <span data-rr="navlabel" style={{ flex: 1 }}>
                {n.label}
              </span>
              {!!badge && (
                <span
                  style={{
                    fontSize: 10,
                    minWidth: 17,
                    textAlign: 'center',
                    padding: '1px 5px',
                    borderRadius: 9,
                    background: active ? 'var(--rr-primary)' : '#E0DBCF',
                    color: active ? '#fff' : '#8A8475',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div data-rr="profile" style={{ marginTop: 14, position: 'relative' }}>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--rr-surface)',
              border: '1px solid var(--rr-border)',
              borderRadius: 11,
              padding: 6,
              boxShadow: 'var(--rr-shadow-float)',
            }}
          >
            <button
              onClick={() => {
                dispatch({ type: 'SET_VIEW', view: 'profile' });
                setMenuOpen(false);
              }}
              style={menuItemStyle('var(--rr-ink)')}
            >
              <span style={{ width: 15, textAlign: 'center', color: '#B0A899' }}>◈</span>Profile
            </button>
            <button style={menuItemStyle('var(--rr-ink)')}>
              <span style={{ width: 15, textAlign: 'center', color: '#B0A899' }}>⚙</span>Account settings
            </button>
            <div style={{ height: 1, background: 'var(--rr-hairline)', margin: '5px 6px' }} />
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: '#B0A899',
                letterSpacing: '0.04em',
                padding: '3px 10px 6px',
              }}
            >
              SECURED BY AWS COGNITO
            </div>
            <button
              onClick={() => {
                dispatch({ type: 'SIGN_OUT' });
                setMenuOpen(false);
              }}
              style={menuItemStyle('var(--rr-risk)')}
            >
              <span style={{ width: 15, textAlign: 'center' }}>⮐</span>Sign out
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            border: '1px solid #E6E1D5',
            background: '#F7F4EC',
            borderRadius: 10,
            padding: '9px 10px',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--rr-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              flex: '0 0 auto',
              letterSpacing: '0.02em',
            }}
          >
            {initials(state.acctName)}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--rr-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {state.acctName}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: 'var(--rr-faint)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {state.acctEmail}
            </span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: '#B0A899', flex: '0 0 auto' }}>
            {menuOpen ? '⌃' : '⌄'}
          </span>
        </button>
      </div>
    </aside>
  );
}

function menuItemStyle(color: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '9px 10px',
    borderRadius: 7,
    fontSize: 12.5,
    color,
  };
}
