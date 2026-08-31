/**
 * Pure scoring math — no Firestore, no side effects.
 * All functions are deterministic given the same inputs.
 */
import type {
  GameResult,
  League,
  OwnershipSnapshot,
  WeeklyResultStatus,
} from './types';

// ─── Winner detection ─────────────────────────────────────────────────────────

/**
 * Given finalized game data and member ownership, determine which teams scored
 * exactly 19 in a final game, and which members own at least one of them.
 *
 * Rules:
 *  • Only 'final' games count — in-progress scores are ignored.
 *  • A multi-team owner who has multiple 19-point teams still gets ONE entry
 *    in winningMemberIds (deduplicated).
 *  • Unowned teams that score 19 appear in teamsAt19 but contribute no member.
 */
export function computeWinningMembers(
  games: GameResult[],
  members: { id: string; teams: string[] }[]
): { teamsAt19: string[]; winningMemberIds: string[] } {
  // Collect all teams that scored exactly 19 in a final game.
  const teamsAt19 = new Set<string>();
  for (const game of games) {
    if (game.status !== 'final') continue;
    if (game.homeScore === 19) teamsAt19.add(game.homeAbbr);
    if (game.awayScore === 19) teamsAt19.add(game.awayAbbr);
  }

  // Collect the (deduped) members who own at least one winning team.
  const winningMemberIds = new Set<string>();
  for (const member of members) {
    for (const abbr of member.teams) {
      if (teamsAt19.has(abbr)) {
        winningMemberIds.add(member.id);
        break; // First match suffices — can't win twice.
      }
    }
  }

  return {
    teamsAt19: Array.from(teamsAt19),
    winningMemberIds: Array.from(winningMemberIds),
  };
}

/**
 * Same winner detection as computeWinningMembers, but sourced from a frozen
 * per-week ownership snapshot instead of the live members list. This is what
 * scoringWriter uses, so a roster change or a Roulette reshuffle after the
 * fact can never rewrite who won a past week.
 *
 * computeWinningMembers is kept for callers that legitimately want live
 * ownership.
 */
export function computeWinningMembersFromOwnership(
  games: GameResult[],
  ownership: OwnershipSnapshot
): { teamsAt19: string[]; winningMemberIds: string[] } {
  const teamsAt19 = new Set<string>();
  for (const game of games) {
    if (game.status !== 'final') continue;
    if (game.homeScore === 19) teamsAt19.add(game.homeAbbr);
    if (game.awayScore === 19) teamsAt19.add(game.awayAbbr);
  }

  const winningMemberIds = new Set<string>();
  for (const [memberId, teams] of Object.entries(ownership)) {
    for (const abbr of teams) {
      if (teamsAt19.has(abbr)) {
        winningMemberIds.add(memberId);
        break; // First match suffices, a member can't win twice.
      }
    }
  }

  return {
    teamsAt19: Array.from(teamsAt19),
    winningMemberIds: Array.from(winningMemberIds),
  };
}

// ─── Pot math ─────────────────────────────────────────────────────────────────

/**
 * Weekly base share = floor((entry × members) / 18).
 * Rounded down so we never exceed the collected pot.
 */
export function computeWeeklyShare(
  seasonEntry: number,
  memberCount: number
): number {
  if (memberCount === 0) return 0;
  return Math.floor((seasonEntry * memberCount) / 18);
}

/**
 * Total pot for this week = base share + any prior rolled-over amounts.
 */
export function computePot(weeklyShare: number, rolloverFrom: number): number {
  return weeklyShare + rolloverFrom;
}

// ─── Season pot (auto vs manual) ─────────────────────────────────────────────

/**
 * The authoritative season pot for the current state of the league.
 *  • potOverride == null → auto (seasonEntry × memberCount)
 *  • potOverride != null → the manually-set value
 * Prefer this over ad-hoc multiplication so auto/manual behavior is honored
 * everywhere.
 */
export function getSeasonPot(league: League): number {
  if (league.potOverride !== null) return league.potOverride;
  return league.seasonEntry * (league.memberCount ?? 0);
}

/** True when the commissioner has manually overridden the pot. */
export function isPotManuallySet(league: League): boolean {
  return league.potOverride !== null;
}

/**
 * Weekly share derived from the (possibly overridden) pot.
 *
 * Rounded to the nearest cent — NOT floored to whole dollars. Reason:
 * $1,600 / 18 = $88.888…; a whole-dollar floor gives $88 × 18 = $1,584 and
 * strands $16. Cent-level rounding gives $88.89 × 18 = $1,600.02, i.e.
 * a 2¢ artifact at worst. Real leagues Venmo cents, so this matches how
 * commissioners already think about payouts.
 */
export function computeWeeklyShareFromPot(pot: number, weeks = 18): number {
  if (weeks <= 0) return 0;
  return Math.round((pot / weeks) * 100) / 100;
}

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Derive week status from game data and winner list:
 *  • Any game in_progress  → 'in_progress'
 *  • Any game scheduled    → 'in_progress' (week hasn't fully started)
 *  • All final + winners   → 'final'
 *  • All final + no winners→ 'rolled_over'
 *  • No games at all       → 'in_progress' (data hasn't loaded yet)
 */
export function computeStatus(
  games: GameResult[],
  winningMemberIds: string[]
): WeeklyResultStatus {
  if (games.length === 0) return 'in_progress';

  if (games.some((g) => g.status === 'in_progress')) return 'in_progress';
  if (games.some((g) => g.status === 'scheduled')) return 'in_progress';

  // All games are 'final'.
  return winningMemberIds.length > 0 ? 'final' : 'rolled_over';
}
