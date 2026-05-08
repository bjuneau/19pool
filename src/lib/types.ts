import type { Timestamp } from 'firebase/firestore';

export const LEAGUE_CAPACITY = 32;

export type LeagueStatus = 'recruiting' | 'assigned' | 'in_season' | 'complete';

export type League = {
  name: string;
  code: string;
  commissionerId: string;
  commissionerEmail: string;
  commissionerName: string;
  seasonEntry: number;
  venmo: string;
  pot: number;
  season: number;
  createdAt: Timestamp | null;
  memberCount: number;
  status: LeagueStatus;
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
    venmo: (raw.venmo as string) ?? '',
    pot: (raw.pot as number) ?? 0,
    season: (raw.season as number) ?? new Date().getFullYear(),
    createdAt: (raw.createdAt as Timestamp) ?? null,
    memberCount: (raw.memberCount as number) ?? 0,
    status: (raw.status as LeagueStatus) ?? 'recruiting',
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
};

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
};
