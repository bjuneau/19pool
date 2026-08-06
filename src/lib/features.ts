import type { League } from './types';

// Feature-flag helpers. Every UI/route that gates a paid feature should read
// through one of these — no inline booleans. This way we can wire the
// Commissioner Pro tier (or per-league entitlements, or A/B rollouts) by
// changing one function body, without touching call sites.

/**
 * True when this league can use the payment tracker (Payments tab).
 * Currently always true. Will be gated behind Commissioner Pro when the paid
 * tier ships — likely by reading a `pro: boolean` flag on the league doc, or
 * an entitlement lookup keyed by commissionerId.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasPaymentTracker(_league: League): boolean {
  return true;
}
