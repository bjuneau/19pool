/**
 * Pure reshuffle decision logic, shared by the commissioner button (Firebase
 * client SDK) and the cron endpoint (firebase-admin).
 *
 * This module must never import a Firestore SDK or perform a read or write.
 * It takes already-fetched ESPN data and already-loaded member rows, and
 * returns decisions. Both callers do their own IO. That is the only way the
 * two paths can be guaranteed to make identical decisions.
 */
import { distributeTeams } from './teamAssignment';
import { TEAM_BY_ABBR } from './teams';
import type { GameResult } from './types';

// ─── Preflight ────────────────────────────────────────────────────────────────

export type PreflightResult =
  | { ok: true; week: number }
  | { ok: false; week: number | null; reason: string; details: string[] };

export function matchupLabel(awayAbbr: string, homeAbbr: string): string {
  const away = TEAM_BY_ABBR[awayAbbr]?.name ?? awayAbbr;
  const home = TEAM_BY_ABBR[homeAbbr]?.name ?? homeAbbr;
  return `${away} at ${home}`;
}

/**
 * A reshuffle is only safe in the gap between weeks: after every game of the
 * current week has finished, and before the first game of the next week has
 * kicked off. Reshuffling inside either window would change ownership while a
 * week is live.
 *
 * Pass an empty nextWeekGames for week 18. There is no next week to protect,
 * so check 2 is skipped.
 */
export function evaluatePreflight(
  currentWeekGames: GameResult[],
  nextWeekGames: GameResult[],
  week: number
): PreflightResult {
  if (currentWeekGames.length === 0) {
    return {
      ok: false,
      week,
      reason: `ESPN returned no games for Week ${week}, so the week cannot be verified as finished.`,
      details: [],
    };
  }

  // Check 1: every game of the current week is final.
  const unfinished = currentWeekGames.filter((g) => g.status !== 'final');
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

  // Check 2: the next week has not kicked off.
  if (week < 18) {
    const started = nextWeekGames.filter((g) => g.status !== 'scheduled');
    if (started.length > 0) {
      return {
        ok: false,
        week,
        reason: `Week ${week + 1} has already kicked off. Reshuffling now would change ownership mid week.`,
        details: started.map((g) => matchupLabel(g.awayAbbr, g.homeAbbr)),
      };
    }

    const earliest = earliestKickoffMs(nextWeekGames);
    if (earliest !== null && Date.now() >= earliest) {
      return {
        ok: false,
        week,
        reason: `Week ${week + 1} has already kicked off. Reshuffling now would change ownership mid week.`,
        details: [`First kickoff was ${new Date(earliest).toLocaleString()}.`],
      };
    }
  }

  return { ok: true, week };
}

// ─── Reshuffle window ─────────────────────────────────────────────────────────

const WINDOW_MS = 48 * 60 * 60 * 1000;

export type ReshuffleWindow = {
  inWindow: boolean;
  earliestKickoff: number | null;
};

/** Earliest kickoff across a set of games, or null when none can be parsed. */
export function earliestKickoffMs(games: GameResult[]): number | null {
  const times = games
    .map((g) => new Date(g.startsAt).getTime())
    .filter((t) => Number.isFinite(t));
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * True when `now` sits inside the 48 hours immediately before the next week's
 * first kickoff. Used only by the cron, to decide whether this is a run worth
 * acting on. The button does not gate on this: a commissioner clicking the
 * button has already chosen their moment, and preflight is what keeps them
 * safe.
 *
 * An empty nextWeekGames (week 18, or ESPN with nothing scheduled) yields
 * inWindow false, so the cron never fires after the final week.
 */
export function isInReshuffleWindow(
  nextWeekGames: GameResult[],
  now: Date
): ReshuffleWindow {
  const earliestKickoff = earliestKickoffMs(nextWeekGames);
  if (earliestKickoff === null) return { inWindow: false, earliestKickoff: null };

  const msUntil = earliestKickoff - now.getTime();
  return {
    // Already kicked off is not "in the window". Preflight would block it
    // anyway, but skipping here avoids the wasted work.
    inWindow: msUntil > 0 && msUntil <= WINDOW_MS,
    earliestKickoff,
  };
}

// ─── Distribution ─────────────────────────────────────────────────────────────

// Structural, so both the client MemberWithId and an admin-SDK row satisfy it.
// joinedAt is only ever tested for null, never read, so its concrete Timestamp
// type does not matter here.
export type ReshuffleMember = {
  id: string;
  joinedAt: unknown;
};

export type DistributionPlan = {
  assignments: Record<string, string[]>;
  unowned: string[];
  /** Members receiving a new roster. */
  joinedIds: string[];
  /**
   * Members who must be reset to no teams. distributeTeams only deals to
   * joined members, so a pending invite still holding teams from an earlier
   * deal would own teams that were just handed to someone else.
   */
  pendingIds: string[];
};

/**
 * Wraps distributeTeams with the same rules the initial assignment and the
 * pre-lock reroll use: only joined members are dealt in, and anyone not yet
 * joined is cleared.
 */
export function planDistribution(members: ReshuffleMember[]): DistributionPlan {
  const joinedIds = members.filter((m) => m.joinedAt != null).map((m) => m.id);
  const pendingIds = members.filter((m) => m.joinedAt == null).map((m) => m.id);
  const { assignments, unowned } = distributeTeams(joinedIds);
  return { assignments, unowned, joinedIds, pendingIds };
}
