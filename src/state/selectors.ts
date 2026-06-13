// Shared derived-state selectors, so the sidebar badge, nav visibility and
// the Gems view can never disagree about what counts as a visible gem.

import { DIMS } from '../data/seed';
import type { Gem, Role } from '../domain/types';
import type { SweepOutcome } from '../data/remote';
import type { AppState } from './store';

/** Roles the Roles view lists (pre-sort): not dismissed, company not
 *  excluded, passing the Canada and below-level filters. Drives both the
 *  page and the sidebar badge so they can never disagree. */
export function visibleRoles(s: AppState): Role[] {
  return s.roles
    .filter((r) => !s.dismissed[r.id] && !s.excluded.includes(r.company))
    .filter(
      (r) =>
        !s.canadaOnly || r.elig.state === 'ca' || r.elig.state === 'remote' || s.overrides[r.id],
    )
    .filter((r) => !s.hideBelow || (r.verdict !== 'below' && r.verdict !== 'mismatch'));
}

/** Roles currently hidden by the active filters (Canada / below-level) but
 *  not yet dismissed — the set the "Dismiss hidden roles" action clears. */
export function hiddenRoles(s: AppState): Role[] {
  const visible = new Set(visibleRoles(s).map((r) => r.id));
  return s.roles.filter(
    (r) => !s.dismissed[r.id] && !s.excluded.includes(r.company) && !visible.has(r.id),
  );
}

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

/** Honest post-sweep summary line for the Scouts view. Reconciles the raw
 *  scan funnel with what's actually actionable for the owner: it counts the
 *  net-new roles and gems that cleared the SAME filters the sidebar uses, and
 *  says so plainly when nothing new got through — so a sweep that surfaced
 *  hundreds of non-Canada matches never reads as if they need attention.
 *  `before` is the pre-sweep state; `outcome` carries the post-sweep records. */
export function sweepSummaryLine(before: AppState, outcome: SweepOutcome): string {
  const after = {
    ...before,
    roles: outcome.roles,
    gems: outcome.gems,
    dismissed: outcome.dismissed,
    overrides: outcome.overrides,
    gemDecisions: outcome.gemDecisions,
  } as AppState;

  const visibleNow = visibleRoles(after).length;
  const newVisible = Math.max(0, visibleNow - visibleRoles(before).length);
  const newGems = Math.max(0, pendingGemCount(after) - pendingGemCount(before));

  const fetched = outcome.summary.fetched;
  const rawGems = outcome.summary.gems;
  const phantoms = outcome.summary.phantoms;
  const pl = (n: number) => (n === 1 ? '' : 's');

  let line: string;
  if (newVisible > 0 || newGems > 0) {
    const parts: string[] = [];
    if (newVisible > 0) parts.push(`${newVisible} new Canada-eligible role${pl(newVisible)}`);
    if (newGems > 0) parts.push(`${newGems} new gem${pl(newGems)} to review`);
    line = `${parts.join(' · ')} — from ${fetched.toLocaleString()} postings scanned.`;
  } else {
    line =
      `No new Canada-eligible roles this sweep — your ${visibleNow} role${pl(visibleNow)} ` +
      `${visibleNow === 1 ? 'is' : 'are'} unchanged.`;
    if (rawGems > 0) {
      line += ` (${rawGems} content match${rawGems === 1 ? '' : 'es'} surfaced, all outside your Canada filter or already decided.)`;
    }
  }
  if (phantoms > 0) line += ` ${phantoms} phantom${pl(phantoms)} flagged.`;
  return line;
}
