/**
 * Coordinates ESPN fetch + scoring math + Firestore persistence.
 * Idempotent: safe to call multiple times for the same week.
 */
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { fetchEspnWeek, getEffectiveSeason } from './espn';
import {
  computePot,
  computeStatus,
  computeWeeklyShareFromPot,
  computeWinningMembersFromOwnership,
  getSeasonPot,
} from './scoring';
import { normalizeWeeklyResult } from './types';
import type { League, OwnershipSnapshot, WeeklyResult } from './types';
import type { MemberWithId } from './members';

// Zero-padded week ID for Firestore document names ('01' … '18').
// Natural sorting in Firestore Console matches numeric week order.
const weekDocId = (week: number) => String(week).padStart(2, '0');

// Skip re-fetching ESPN for settled weeks cached within the last 24 h.
const SETTLED_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// ─── Ownership snapshot ───────────────────────────────────────────────────────

/**
 * Freeze the current roster into a memberId -> teams map. Members holding no
 * teams are omitted so the snapshot stays a record of actual ownership rather
 * than a roster listing.
 */
function buildOwnershipFromMembers(members: MemberWithId[]): OwnershipSnapshot {
  const snapshot: OwnershipSnapshot = {};
  for (const m of members) {
    if (m.teams && m.teams.length > 0) {
      snapshot[m.id] = [...m.teams];
    }
  }
  return snapshot;
}

// ─── Rollover computation ─────────────────────────────────────────────────────

/**
 * Walk backwards from (week - 1). Accumulate weeklyShare for every consecutive
 * 'rolled_over' week. Stop at the first 'final', 'in_progress', or missing doc.
 *
 * Example:
 *   W1 final  → rolloverFrom(W2) = 0
 *   W2 rolled → rolloverFrom(W3) = W2.weeklyShare
 *   W3 rolled → rolloverFrom(W4) = W2.weeklyShare + W3.weeklyShare
 *   W4 final  → rolloverFrom(W5) = 0
 */
function rolloverFrom(
  allResults: Map<number, WeeklyResult>,
  week: number
): number {
  let total = 0;
  for (let w = week - 1; w >= 1; w--) {
    const r = allResults.get(w);
    if (!r || r.status !== 'rolled_over') break;
    total += r.weeklyShare;
  }
  return total;
}

// ─── Main refresh function ────────────────────────────────────────────────────

/**
 * Refresh one week's results in Firestore.
 *
 * 1. Read existing doc — skip ESPN fetch if settled AND cache fresh (< 24 h).
 * 2. Fetch ESPN.
 * 3. Compute winners, rollover, status, payouts.
 * 4. Write to Firestore.
 * 5. Return the newly written WeeklyResult.
 *
 * Returns null when:
 *  - League isn't in_season.
 *  - ESPN returns no games (future week, off-season).
 */
export async function refreshWeek(
  leagueCode: string,
  week: number,
  league: League,
  members: MemberWithId[]
): Promise<WeeklyResult | null> {
  if (league.status !== 'in_season') return null;

  const weekRef = doc(db, 'leagues', leagueCode, 'weeklyResults', weekDocId(week));

  // Check whether we can use the cached result.
  const existing = await getDoc(weekRef);
  const existingData = existing.exists()
    ? normalizeWeeklyResult(existing.data() as Record<string, unknown>)
    : null;

  if (existingData) {
    const isSettled =
      existingData.status === 'final' || existingData.status === 'rolled_over';
    if (isSettled && existingData.fetchedAt) {
      const ageMs = Date.now() - existingData.fetchedAt.toMillis();
      if (ageMs < SETTLED_CACHE_AGE_MS) return existingData;
    }
  }

  // Fetch ESPN data (via /api/espn-scores proxy). Wrap the season in
  // getEffectiveSeason so test-mode fetches historical data instead of the
  // league's declared year.
  const fetchSeason = getEffectiveSeason(league.season);
  let games;
  try {
    games = await fetchEspnWeek(fetchSeason, week);
  } catch (err) {
    console.error('[scoringWriter] ESPN fetch failed for week', week, err);
    return existingData; // serve stale if available
  }

  // No games = future week with nothing scheduled yet.
  if (games.length === 0) return null;

  // Read all prior weeklyResults to compute rollover.
  const collSnap = await getDocs(
    collection(db, 'leagues', leagueCode, 'weeklyResults')
  );
  const allResults = new Map<number, WeeklyResult>();
  for (const d of collSnap.docs) {
    const wr = normalizeWeeklyResult(d.data() as Record<string, unknown>);
    allResults.set(wr.week, wr);
  }

  // Pure math. Weekly share is derived from the (possibly overridden) pot
  // so a manual pot flows through to per-week payouts.
  const weeklyShare = computeWeeklyShareFromPot(getSeasonPot(league));
  const rollover = rolloverFrom(allResults, week);

  // Ownership snapshot. The window for updating it closes the moment any game
  // in the week goes final: from then on, who owned what is history and a
  // later roster change or Roulette reshuffle must not rewrite it.
  const nowTs = Timestamp.now();
  const hasAnyFinal = games.some((g) => g.status === 'final');
  let ownership: OwnershipSnapshot;
  let ownershipLockedAt: Timestamp | null;
  if (existingData?.ownershipLockedAt) {
    // Already locked by an earlier refresh. Keep it verbatim.
    ownership = existingData.ownership;
    ownershipLockedAt = existingData.ownershipLockedAt;
  } else if (hasAnyFinal) {
    // First refresh that sees a final game. Snapshot now, then lock.
    ownership = buildOwnershipFromMembers(members);
    ownershipLockedAt = nowTs;
  } else {
    // Nothing final yet, so the snapshot stays fresh on every refresh.
    ownership = buildOwnershipFromMembers(members);
    ownershipLockedAt = null;
  }

  // Winners come from the snapshot, never from the live members list.
  const { teamsAt19, winningMemberIds } = computeWinningMembersFromOwnership(
    games,
    ownership
  );
  const status = computeStatus(games, winningMemberIds);
  const totalPot = computePot(weeklyShare, rollover);
  const payoutPerWinner =
    winningMemberIds.length > 0
      ? Math.round((totalPot / winningMemberIds.length) * 100) / 100
      : 0;

  const wasSettled =
    existingData?.status === 'final' || existingData?.status === 'rolled_over';
  const nowSettled = status === 'final' || status === 'rolled_over';

  const result: WeeklyResult = {
    week,
    // Store the season actually fetched — not the league's declared year —
    // so a doc's `season` matches the data inside it. In production this is
    // identical to league.season; in test mode it becomes the override year.
    season: fetchSeason,
    fetchedAt: nowTs,
    games,
    teamsAt19,
    winningMemberIds,
    weeklyShare,
    rolloverFrom: rollover,
    payoutPerWinner,
    status,
    settledAt:
      nowSettled && !wasSettled
        ? nowTs
        : (existingData?.settledAt ?? null),
    ownership,
    ownershipLockedAt,
  };

  await setDoc(weekRef, result);
  return result;
}

// ─── Convenience: refresh all 18 weeks ───────────────────────────────────────

/**
 * Walk all 18 weeks and refresh each one.
 * Settled + cached weeks are skipped cheaply (a single Firestore read each).
 * Future weeks with no ESPN data are silently skipped.
 *
 * NOTE: rollover math requires prior weeks to be refreshed first. This
 * function processes weeks 1→18 in order, so rollover should be correct as
 * long as all prior weeks have been refreshed at least once.
 *
 * Known limitation: if a prior week is still 'in_progress' when this runs,
 * the downstream rollover for subsequent weeks may be 0 until that week settles.
 */
export async function refreshAllWeeks(
  leagueCode: string,
  league: League,
  members: MemberWithId[]
): Promise<WeeklyResult[]> {
  if (league.status !== 'in_season') return [];

  const results: WeeklyResult[] = [];
  for (let week = 1; week <= 18; week++) {
    const result = await refreshWeek(leagueCode, week, league, members);
    if (result) results.push(result);
  }
  return results;
}
