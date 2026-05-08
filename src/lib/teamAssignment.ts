import { NFL_TEAMS, TEAM_COUNT } from './teams';

export type TeamAssignmentState = {
  assignments: Record<string, string[]>; // memberId → team abbrs
  unowned: string[];
};

/**
 * Distributes all 32 NFL teams across N members.
 * Each member gets exactly Math.floor(32 / N) teams.
 * Leftover teams (32 % N) are returned as `unowned`.
 *
 * Uses Fisher-Yates shuffle with crypto.getRandomValues for fairness.
 * Pure function — no Firestore writes, no side effects.
 */
export function distributeTeams(memberIds: string[]): TeamAssignmentState {
  if (memberIds.length === 0) {
    return { assignments: {}, unowned: NFL_TEAMS.map((t) => t.abbr) };
  }

  const shuffled = cryptoShuffle(NFL_TEAMS.map((t) => t.abbr));
  const n = memberIds.length;
  const perMember = Math.floor(TEAM_COUNT / n);

  const assignments: Record<string, string[]> = {};
  for (let i = 0; i < n; i++) {
    assignments[memberIds[i]] = shuffled.slice(i * perMember, (i + 1) * perMember);
  }

  const unowned = shuffled.slice(n * perMember);
  return { assignments, unowned };
}

/**
 * Moves a single team between two roster slots.
 * Pass null for fromMemberId / toMemberId to move from/to the unowned pool.
 * Pure function — caller does the Firestore write.
 */
export function swapTeams(
  current: TeamAssignmentState,
  team: string,
  fromMemberId: string | null,
  toMemberId: string | null
): TeamAssignmentState {
  // Deep-copy so callers can compare old vs new safely.
  const assignments: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(current.assignments)) {
    assignments[k] = [...v];
  }
  const unowned = [...current.unowned];

  // Remove from source
  if (fromMemberId === null) {
    const idx = unowned.indexOf(team);
    if (idx !== -1) unowned.splice(idx, 1);
  } else {
    assignments[fromMemberId] = (assignments[fromMemberId] ?? []).filter(
      (t) => t !== team
    );
  }

  // Add to destination (guard against duplicates)
  if (toMemberId === null) {
    if (!unowned.includes(team)) unowned.push(team);
  } else {
    if (!assignments[toMemberId]) assignments[toMemberId] = [];
    if (!assignments[toMemberId].includes(team)) assignments[toMemberId].push(team);
  }

  return { assignments, unowned };
}

// Fisher-Yates shuffle using crypto.getRandomValues instead of Math.random.
function cryptoShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    // Modulo bias is negligible for small arrays (≤32 items vs 2^32 range).
    const j = buf[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
