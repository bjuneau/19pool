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
import { fetchEspnWeek } from './espn';
import {
  computePot,
  computeStatus,
  computeWeeklyShare,
  computeWinningMembers,
} from './scoring';
import type { League, WeeklyResult } from './types';
import type { MemberWithId } from './members';

// Zero-padded week ID for Firestore document names ('01' … '18').
// Natural sorting in Firestore Console matches numeric week order.
const weekDocId = (week: number) => String(week).padStart(2, '0');

// Skip re-fetching ESPN for settled weeks cached within the last 24 h.
const SETTLED_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

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
  const existingData = existing.exists() ? (existing.data() as WeeklyResult) : null;

  if (existingData) {
    const isSettled =
      existingData.status === 'final' || existingData.status === 'rolled_over';
    if (isSettled && existingData.fetchedAt) {
      const ageMs = Date.now() - existingData.fetchedAt.toMillis();
      if (ageMs < SETTLED_CACHE_AGE_MS) return existingData;
    }
  }

  // Fetch ESPN data (via /api/espn-scores proxy).
  let games;
  try {
    games = await fetchEspnWeek(league.season, week);
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
    const wr = d.data() as WeeklyResult;
    allResults.set(wr.week, wr);
  }

  // Pure math.
  const weeklyShare = computeWeeklyShare(league.seasonEntry, league.memberCount);
  const rollover = rolloverFrom(allResults, week);
  const { teamsAt19, winningMemberIds } = computeWinningMembers(games, members);
  const status = computeStatus(games, winningMemberIds);
  const totalPot = computePot(weeklyShare, rollover);
  const payoutPerWinner =
    winningMemberIds.length > 0
      ? Math.round((totalPot / winningMemberIds.length) * 100) / 100
      : 0;

  const wasSettled =
    existingData?.status === 'final' || existingData?.status === 'rolled_over';
  const nowSettled = status === 'final' || status === 'rolled_over';

  const nowTs = Timestamp.now();
  const result: WeeklyResult = {
    week,
    season: league.season,
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
