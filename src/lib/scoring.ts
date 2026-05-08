/**
 * Pure scoring math — no Firestore, no side effects.
 * All functions are deterministic given the same inputs.
 */
import type { GameResult, WeeklyResultStatus } from './types';

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
