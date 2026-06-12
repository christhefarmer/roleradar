// Shared derived-state selectors, so the sidebar badge, nav visibility and
// the Gems view can never disagree about what counts as a visible gem.

import type { Gem } from '../domain/types';
import type { AppState } from './store';

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
