/**
 * Commissioner-triggered manual reshuffle for Roulette leagues.
 *
 * Firestore IO and ESPN fetching live here. Every decision is delegated to
 * reshuffleCore so the cron endpoint, which runs on firebase-admin, makes
 * byte-identical choices without the logic being written twice.
 */
import { Timestamp, arrayUnion, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { fetchEspnWeek, getCurrentNFLWeek, getEffectiveSeason } from './espn';
import { evaluatePreflight, planDistribution } from './reshuffleCore';
import type { PreflightResult } from './reshuffleCore';
import { refreshWeek } from './scoringWriter';
import type { League, ReshuffleRecord } from './types';
import type { MemberWithId } from './members';

export type { PreflightResult } from './reshuffleCore';

// ─── Preflight ────────────────────────────────────────────────────────────────

/**
 * Fetches the schedule this decision needs, then hands off to the pure
 * evaluator. Week 18 has no next week, so an empty list is passed and the
 * next-week check is skipped.
 */
export async function preflightReshuffle(
  league: League
): Promise<PreflightResult> {
  const week = getCurrentNFLWeek(league.season);
  if (week === null) {
    return {
      ok: false,
      week: null,
      reason: 'There is no active NFL week right now.',
      details: [],
    };
  }

  const season = getEffectiveSeason(league.season);

  try {
    const currentWeekGames = await fetchEspnWeek(season, week);
    // Fetch next week only when it can actually matter. evaluatePreflight
    // returns on the current-week check before it looks at nextWeekGames, so
    // passing [] here cannot change the verdict, and it saves a proxy round
    // trip on the common blocked path. The cron does not do this: it fetches
    // both weeks once and reuses them across every league.
    const allFinal =
      currentWeekGames.length > 0 &&
      currentWeekGames.every((g) => g.status === 'final');
    const nextWeekGames =
      allFinal && week < 18 ? await fetchEspnWeek(season, week + 1) : [];
    return evaluatePreflight(currentWeekGames, nextWeekGames, week);
  } catch (err) {
    return {
      ok: false,
      week,
      reason: 'Could not reach ESPN to verify the schedule. Try again shortly.',
      details: [(err as Error).message],
    };
  }
}

// ─── Execution ────────────────────────────────────────────────────────────────

export type ReshuffleOutcome =
  | { ok: true; week: number; membersReassigned: number; unowned: string[] }
  | { ok: false; stage: 'snapshot' | 'write'; message: string };

/**
 * Runs the reshuffle in the only order that is safe:
 *
 *  1. Force a refreshWeek so the current week's ownership snapshot is written
 *     and locked from the OUTGOING rosters. Abort if it does not come back
 *     locked, since without that lock a later refresh could recompute this
 *     week's winners against the new rosters.
 *  2. Redistribute the 32 teams with the same crypto shuffle used for the
 *     initial assignment.
 *  3. Write every member's new teams, the league's new unowned pool, and the
 *     reshuffleHistory entry in a single batch, so they cannot land half
 *     applied.
 *
 * If the batch fails, the lock from step 1 still protects the completed week.
 */
export async function executeReshuffle(
  leagueCode: string,
  league: League,
  members: MemberWithId[],
  week: number,
  byUserId: string
): Promise<ReshuffleOutcome> {
  // ── Step 1: freeze the outgoing rosters onto the current week ────────────
  let snapshotted;
  try {
    snapshotted = await refreshWeek(leagueCode, week, league, members);
  } catch (err) {
    console.error('[reshuffle] snapshot refresh threw', err);
    return {
      ok: false,
      stage: 'snapshot',
      message: `Could not lock Week ${week} results before reshuffling: ${
        (err as Error).message
      }. No teams were changed. Try again.`,
    };
  }

  if (!snapshotted || !snapshotted.ownershipLockedAt) {
    console.error('[reshuffle] week did not come back locked', {
      week,
      hasDoc: !!snapshotted,
      lockedAt: snapshotted?.ownershipLockedAt ?? null,
    });
    return {
      ok: false,
      stage: 'snapshot',
      message: `Week ${week} did not lock its ownership snapshot, so the reshuffle was cancelled. No teams were changed. Refresh the week's scores, then try again.`,
    };
  }

  // ── Step 2: redistribute ─────────────────────────────────────────────────
  const plan = planDistribution(members);

  // ── Steps 3 and 4: one batch so they cannot land half applied ────────────
  const record: ReshuffleRecord = { week, at: Timestamp.now(), byUserId };

  try {
    const batch = writeBatch(db);
    for (const id of plan.joinedIds) {
      batch.update(doc(db, 'leagues', leagueCode, 'members', id), {
        teams: plan.assignments[id] ?? [],
      });
    }
    for (const id of plan.pendingIds) {
      batch.update(doc(db, 'leagues', leagueCode, 'members', id), { teams: [] });
    }
    batch.update(doc(db, 'leagues', leagueCode), {
      unownedTeams: plan.unowned,
      teamsAssignedAt: Timestamp.now(),
      reshuffleHistory: arrayUnion(record),
    });
    await batch.commit();
  } catch (err) {
    console.error('[reshuffle] roster write failed', err);
    return {
      ok: false,
      stage: 'write',
      message: `Week ${week} results are locked and safe, but the new team assignments failed to save: ${
        (err as Error).message
      }. Try the reshuffle again.`,
    };
  }

  return {
    ok: true,
    week,
    membersReassigned: plan.joinedIds.length,
    unowned: plan.unowned,
  };
}
