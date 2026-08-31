/**
 * Commissioner-triggered manual reshuffle for Roulette leagues.
 *
 * Client-side only: it reuses the existing /api/espn-scores proxy and the
 * existing crypto shuffle, and adds no serverless function.
 *
 * The ordering below is the whole safety story. The outgoing rosters must be
 * frozen onto the current week's weeklyResults doc BEFORE anyone's teams
 * change, otherwise that week's winner detection would silently be recomputed
 * against the incoming rosters.
 */
import {
  Timestamp,
  arrayUnion,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { fetchEspnWeek, getCurrentNFLWeek, getEffectiveSeason } from './espn';
import { refreshWeek } from './scoringWriter';
import { distributeTeams } from './teamAssignment';
import { TEAM_BY_ABBR } from './teams';
import type { League, ReshuffleRecord } from './types';
import type { MemberWithId } from './members';

// ─── Preflight ────────────────────────────────────────────────────────────────

export type PreflightResult =
  | { ok: true; week: number }
  | { ok: false; week: number | null; reason: string; details: string[] };

const matchupLabel = (awayAbbr: string, homeAbbr: string): string => {
  const away = TEAM_BY_ABBR[awayAbbr]?.name ?? awayAbbr;
  const home = TEAM_BY_ABBR[homeAbbr]?.name ?? homeAbbr;
  return `${away} at ${home}`;
};

/**
 * A reshuffle is only safe in the gap between weeks: after every game of the
 * current week has finished, and before the first game of the next week has
 * kicked off. Reshuffling inside either window would change ownership while a
 * week is live.
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

  let games;
  try {
    games = await fetchEspnWeek(season, week);
  } catch (err) {
    return {
      ok: false,
      week,
      reason: 'Could not reach ESPN to verify the schedule. Try again shortly.',
      details: [(err as Error).message],
    };
  }

  if (games.length === 0) {
    return {
      ok: false,
      week,
      reason: `ESPN returned no games for Week ${week}, so the week cannot be verified as finished.`,
      details: [],
    };
  }

  // Check 1: every game of the current week is final.
  const unfinished = games.filter((g) => g.status !== 'final');
  if (unfinished.length > 0) {
    return {
      ok: false,
      week,
      reason: `Week ${week} is not finished. ${unfinished.length} game${
        unfinished.length === 1 ? '' : 's'
      } still to settle.`,
      details: unfinished.map(
        (g) =>
          `${matchupLabel(g.awayAbbr, g.homeAbbr)} (${
            g.status === 'in_progress' ? 'live now' : 'not started'
          })`
      ),
    };
  }

  // Check 2: the next week has not kicked off. Week 18 has no next week, so
  // there is nothing left to protect.
  if (week < 18) {
    let nextGames;
    try {
      nextGames = await fetchEspnWeek(season, week + 1);
    } catch (err) {
      return {
        ok: false,
        week,
        reason: 'Could not reach ESPN to verify next week has not started.',
        details: [(err as Error).message],
      };
    }

    const started = nextGames.filter((g) => g.status !== 'scheduled');
    if (started.length > 0) {
      return {
        ok: false,
        week,
        reason: `Week ${week + 1} has already kicked off. Reshuffling now would change ownership mid week.`,
        details: started.map((g) => matchupLabel(g.awayAbbr, g.homeAbbr)),
      };
    }

    const kickoffs = nextGames
      .map((g) => new Date(g.startsAt).getTime())
      .filter((t) => Number.isFinite(t));
    if (kickoffs.length > 0) {
      const earliest = Math.min(...kickoffs);
      if (Date.now() >= earliest) {
        return {
          ok: false,
          week,
          reason: `Week ${week + 1} has already kicked off. Reshuffling now would change ownership mid week.`,
          details: [`First kickoff was ${new Date(earliest).toLocaleString()}.`],
        };
      }
    }
  }

  return { ok: true, week };
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
 *     reshuffleHistory entry in a single batch, so steps 3 and 4 cannot land
 *     half applied.
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
  // Same rule as the initial assignment: only joined members receive teams.
  const joinedMembers = members.filter((m) => m.joinedAt != null);
  const { assignments, unowned } = distributeTeams(joinedMembers.map((m) => m.id));

  // ── Steps 3 and 4: one batch so they cannot land half applied ────────────
  const record: ReshuffleRecord = {
    week,
    at: Timestamp.now(),
    byUserId,
  };

  try {
    const batch = writeBatch(db);
    for (const m of joinedMembers) {
      batch.update(doc(db, 'leagues', leagueCode, 'members', m.id), {
        teams: assignments[m.id] ?? [],
      });
    }
    // Clear anyone who has not joined yet. distributeTeams only deals to
    // joined members, so a pending invite still holding teams from a previous
    // deal would own teams that were just handed to someone else. Same guard
    // the pre-lock reroll uses.
    for (const m of members.filter((m) => m.joinedAt == null)) {
      batch.update(doc(db, 'leagues', leagueCode, 'members', m.id), { teams: [] });
    }
    batch.update(doc(db, 'leagues', leagueCode), {
      unownedTeams: unowned,
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
    membersReassigned: joinedMembers.length,
    unowned,
  };
}
