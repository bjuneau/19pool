import type { Timestamp } from 'firebase/firestore';

export const LEAGUE_CAPACITY = 32;

export type LeagueStatus = 'recruiting' | 'assigned' | 'in_season' | 'complete';

// How teams get assigned. 'classic' keeps each player's teams for the whole
// season; 'roulette' reshuffles every week. Locked once the season starts.
export type LeagueMode = 'classic' | 'roulette';

// One entry per completed Roulette reshuffle. The authoritative record of who
// owned what is the per-week `ownership` snapshot on weeklyResults; this array
// is just an audit trail of when reshuffles ran and who ran them.
export type ReshuffleRecord = {
  week: number;
  at: Timestamp;
  byUserId: string;
};

export type League = {
  name: string;
  code: string;
  commissionerId: string;
  commissionerEmail: string;
  commissionerName: string;
  seasonEntry: number;
  // null → season pot is auto-calculated as (seasonEntry × memberCount).
  // number → commissioner has manually overridden the pot.
  potOverride: number | null;
  venmo: string;
  pot: number;
  season: number;
  createdAt: Timestamp | null;
  memberCount: number;
  status: LeagueStatus;
  // Defaults to 'classic' so leagues created before Roulette shipped read
  // as the behavior they already have.
  mode: LeagueMode;
  // Audit trail of Roulette reshuffles. Absent on leagues that have never
  // reshuffled.
  reshuffleHistory?: ReshuffleRecord[];
  // Team assignment fields (populated when status moves to 'assigned')
  unownedTeams: string[];
  teamsAssignedAt: Timestamp | null;
  lockedAt: Timestamp | null;
  // When true, the "roster changed after assignment" banner is suppressed
  // until the next reroll (or a new member joins).
  skipReassignmentCheck?: boolean;
};

// Safe defaults for reading league docs that predate the team-assignment fields.
export function normalizeLeague(raw: Record<string, unknown>): League {
  return {
    name: (raw.name as string) ?? '',
    code: (raw.code as string) ?? '',
    commissionerId: (raw.commissionerId as string) ?? '',
    commissionerEmail: (raw.commissionerEmail as string) ?? '',
    commissionerName: (raw.commissionerName as string) ?? '',
    seasonEntry: (raw.seasonEntry as number) ?? 0,
    potOverride:
      typeof raw.potOverride === 'number' ? (raw.potOverride as number) : null,
    venmo: (raw.venmo as string) ?? '',
    pot: (raw.pot as number) ?? 0,
    season: (raw.season as number) ?? new Date().getFullYear(),
    createdAt: (raw.createdAt as Timestamp) ?? null,
    memberCount: (raw.memberCount as number) ?? 0,
    status: (raw.status as LeagueStatus) ?? 'recruiting',
    mode: raw.mode === 'roulette' ? 'roulette' : 'classic',
    reshuffleHistory: Array.isArray(raw.reshuffleHistory)
      ? (raw.reshuffleHistory as ReshuffleRecord[])
      : [],
    unownedTeams: (raw.unownedTeams as string[]) ?? [],
    teamsAssignedAt: (raw.teamsAssignedAt as Timestamp) ?? null,
    lockedAt: (raw.lockedAt as Timestamp) ?? null,
    skipReassignmentCheck: (raw.skipReassignmentCheck as boolean) ?? false,
  };
}

export type MemberRole = 'commissioner' | 'member';

// ─── Scoring types ───────────────────────────────────────────────────────────

export type GameStatus = 'scheduled' | 'in_progress' | 'final';

export type GameResult = {
  espnGameId: string;  // ESPN event ID
  homeAbbr: string;    // e.g. 'BUF'
  awayAbbr: string;    // e.g. 'MIA'
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  startsAt: string;    // ISO string
};

export type WeeklyResultStatus = 'in_progress' | 'final' | 'rolled_over';

// memberId -> team abbreviations that member owned during a given week.
// Snapshotted per week so winner detection and historical display survive
// roster changes and (in Roulette mode) the weekly reshuffle.
export type OwnershipSnapshot = Record<string, string[]>;

export type WeeklyResult = {
  week: number;
  season: number;
  fetchedAt: Timestamp;
  games: GameResult[];
  teamsAt19: string[];
  winningMemberIds: string[];
  weeklyShare: number;
  rolloverFrom: number;
  payoutPerWinner: number;
  status: WeeklyResultStatus;
  settledAt: Timestamp | null;
  // Who owned what while this week was being played. Every week written since
  // snapshots shipped fills this at refresh time; normalizeWeeklyResult
  // defaults it to {} for anything older.
  ownership: OwnershipSnapshot;
  // Null while the snapshot can still be refreshed (no game final yet).
  // Set once the first game of the week finalizes, after which the snapshot
  // is frozen.
  ownershipLockedAt: Timestamp | null;
};

// Safe defaults for reading weeklyResults docs that predate the ownership
// snapshot fields. Mirrors normalizeLeague.
export function normalizeWeeklyResult(raw: Record<string, unknown>): WeeklyResult {
  const rawOwnership = raw.ownership;
  const ownership: OwnershipSnapshot = {};
  if (rawOwnership && typeof rawOwnership === 'object') {
    for (const [memberId, teams] of Object.entries(
      rawOwnership as Record<string, unknown>
    )) {
      if (Array.isArray(teams)) {
        ownership[memberId] = teams.filter(
          (t): t is string => typeof t === 'string'
        );
      }
    }
  }

  return {
    week: (raw.week as number) ?? 0,
    season: (raw.season as number) ?? new Date().getFullYear(),
    fetchedAt: raw.fetchedAt as Timestamp,
    games: (raw.games as GameResult[]) ?? [],
    teamsAt19: (raw.teamsAt19 as string[]) ?? [],
    winningMemberIds: (raw.winningMemberIds as string[]) ?? [],
    weeklyShare: (raw.weeklyShare as number) ?? 0,
    rolloverFrom: (raw.rolloverFrom as number) ?? 0,
    payoutPerWinner: (raw.payoutPerWinner as number) ?? 0,
    status: (raw.status as WeeklyResultStatus) ?? 'in_progress',
    settledAt: (raw.settledAt as Timestamp) ?? null,
    ownership,
    ownershipLockedAt: (raw.ownershipLockedAt as Timestamp) ?? null,
  };
}

// ─── Member ───────────────────────────────────────────────────────────────────

export type Member = {
  uid: string | null;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  teams: string[];
  wins: number;
  closest: number;
  role: MemberRole;
  invitedAt: Timestamp | null;
  joinedAt: Timestamp | null;
  inviteToken: string;
  // Set when an invite email is successfully delivered (initial or resend).
  // Null/undefined = never sent, or send failed — treat both as "free to send".
  lastInviteSentAt: Timestamp | null;
  // Payment tracker. Optional so legacy docs (pre-payment-tracker) read cleanly
  // as unpaid without a data migration.
  paid?: boolean;
  paidAt?: Timestamp | null;
  // Player's own Venmo handle — used by the commissioner's Payments tab to
  // build a charge-request URL targeting the player. Optional; legacy docs and
  // members who haven't set it yet read as no-Venmo. Denormalized from
  // users/{uid}.venmo when the player edits it in Account.
  venmo?: string;
};
