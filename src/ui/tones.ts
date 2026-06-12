// Signal-tone helpers — every color here derives from the three-signal
// palette in DESIGN.md (green = fit, gold = gem/reach, rust = risk) plus the
// warm neutrals. Components never invent accent hues.

import type { ChipTone, DimState, Eligibility, ProposalTone, VerdictKey } from '../domain/types';

export interface TonePill {
  label: string;
  color: string;
  bg: string;
  bd: string;
}

export const VERDICTS: Record<VerdictKey, TonePill> = {
  match: { label: 'MATCH', color: '#0F6B3B', bg: '#E7F1E8', bd: '#C5DDCB' },
  reach: { label: 'REACH', color: '#8A5E14', bg: '#F4ECDA', bd: '#E3D2A8' },
  below: { label: 'BELOW LEVEL', color: '#8A4A2C', bg: '#F1E6DF', bd: '#DCC6B8' },
  mismatch: { label: 'DOMAIN MISMATCH', color: '#8A4A2C', bg: '#F1E6DF', bd: '#DCC6B8' },
};

export function meterColor(s: DimState): string {
  return { hit: '#1E8A4F', partial: '#B07D26', thin: '#D7B49E', na: '#E2DDD2', us: '#B0492B' }[s];
}

export function fillFor(s: DimState): string {
  return { hit: '100%', partial: '55%', thin: '25%', na: '8%', us: '12%' }[s];
}

export function fillColor(s: DimState): string {
  return { hit: '#1E8A4F', partial: '#C39237', thin: '#D7B49E', na: '#D8D3C8', us: '#B0492B' }[s];
}

export function defNote(s: DimState): string {
  if (s === 'hit') return 'Central to this role.';
  if (s === 'partial') return 'Present, not the focus.';
  if (s === 'thin') return 'Lightly referenced.';
  if (s === 'us') return 'Requires US authorization.';
  return 'Not part of this role.';
}

export function chipTone(t: ChipTone): { color: string; bg: string; bd: string } {
  return {
    good: { color: '#0F6B3B', bg: '#E7F1E8', bd: '#C5DDCB' },
    warn: { color: '#8A5E14', bg: '#F4ECDA', bd: '#E3D2A8' },
    bad: { color: '#8A4A2C', bg: '#F1E6DF', bd: '#DCC6B8' },
  }[t];
}

export interface EligVm extends Eligibility {
  color: string;
  bg: string;
  bd: string;
}

/** Eligibility badge follows the signal trio: green confirmed-CA / rust
 *  blocked (US-only or elsewhere international) / gold needs-a-look
 *  (regionless remote, hybrid, unclassified). */
export function eligVm(e: Eligibility): EligVm {
  if (e.state === 'us' || e.state === 'other')
    return { ...e, color: '#B0492B', bg: '#F3E3DB', bd: '#E0C3B5' };
  if (e.state === 'remote' || e.state === 'unknown' || e.label.indexOf('HYBRID') >= 0)
    return { ...e, color: '#8A5E14', bg: '#F4ECDA', bd: '#E3D2A8' };
  return { ...e, color: '#0F6B3B', bg: '#E7F1E8', bd: '#C5DDCB' };
}

export function proposalTone(t: ProposalTone): {
  tagBg: string;
  tagColor: string;
  tagBd: string;
  accent: string;
} {
  return {
    good: { tagBg: '#E7F1E8', tagColor: '#0F6B3B', tagBd: '#C5DDCB', accent: '#1E8A4F' },
    warn: { tagBg: '#F4ECDA', tagColor: '#8A5E14', tagBd: '#E3D2A8', accent: '#C39237' },
    bad: { tagBg: '#F6EAE3', tagColor: '#B0492B', tagBd: '#E6CBBE', accent: '#B0492B' },
  }[t];
}
