// Small shared primitives — mono labels, eligibility badges, chips.
// Rule of thumb from DESIGN.md: if it's a number, a label, or a status,
// it's mono; prose is always sans.

import type { CSSProperties, ReactNode } from 'react';
import type { Eligibility } from '../domain/types';
import { eligVm } from './tones';

export const MONO = "'IBM Plex Mono', monospace";
export const SANS = "'IBM Plex Sans', sans-serif";

/** Uppercase tracked mono section label (DESIGN.md `label-caps` voice). */
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        color: '#A39C8B',
        letterSpacing: '0.08em',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Eligibility badge — heuristic hint, colored by the signal trio. */
export function EligBadge({
  elig,
  fontSize = 10,
}: {
  elig: Eligibility;
  fontSize?: number;
}) {
  const vm = eligVm(elig);
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize,
        padding: '2px 7px',
        borderRadius: 5,
        background: vm.bg,
        color: vm.color,
        border: `1px solid ${vm.bd}`,
        letterSpacing: '0.03em',
        flex: '0 0 auto',
        whiteSpace: 'nowrap',
      }}
    >
      {vm.label}
    </span>
  );
}
