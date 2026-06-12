// Shared derived-state selectors, so the sidebar badge, nav visibility and
// the Gems view can never disagree about what counts as a visible gem.

import { DIMS } from '../data/seed';
import type { Gem } from '../domain/types';
import type { AppState } from './store';

/** The owner's fit dimensions: their top parsed strengths plus the two
 *  universal dimensions (level fit, Canada eligibility). Design mode keeps
 *  the prototype's fixed set. */
export function fitDimensions(s: AppState): [key: string, label: string][] {
  if (!s.connected) return DIMS;
  const fromStrengths = s.strengths
    .filter((st) => st.key !== 'level' && st.key !== 'eligible')
    .slice(0, 6)
    .map((st): [string, string] => [st.key, st.label]);
  return [...fromStrengths, ['level', 'Level fit'], ['eligible', 'Canada eligibility']];
}

/** Gems the Gems view lists: not from an excluded company, not role-dismissed,
 *  not already promoted, and passing the Canada filter (with per-role
 *  overrides). In-session dismissed gems stay (rendered faded as feedback). */
export function gemsForView(s: AppState): Gem[] {
  return s.gems.filter(
    (g) =>
      !s.excluded.includes(g.company) &&
      !s.dismissed[g.id] &&
      s.gemDecisions[g.id] !== 'confirmed' &&
      (!s.canadaOnly || g.elig.state === 'ca' || g.elig.state === 'remote' || s.overrides[g.id]),
  );
}

/** Gems still awaiting a decision AND visible — drives the sidebar badge and
 *  whether Gems earns a nav slot. */
export function pendingGemCount(s: AppState): number {
  return gemsForView(s).filter((g) => !s.gemDecisions[g.id]).length;
}

/** Pending gems hidden only by filters (Canada-eligible / exclusions) — used
 *  for the honest empty-state hint. */
export function hiddenPendingGemCount(s: AppState): number {
  const pendingAll = s.gems.filter(
    (g) => !s.gemDecisions[g.id] && !s.dismissed[g.id],
  ).length;
  return Math.max(0, pendingAll - pendingGemCount(s));
}
