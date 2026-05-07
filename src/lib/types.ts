import type { Timestamp } from 'firebase/firestore';

export const LEAGUE_CAPACITY = 32;

export type LeagueStatus = 'recruiting' | 'locked' | 'in_season' | 'complete';

export type League = {
  name: string;
  code: string;
  commissionerId: string;
  commissionerEmail: string;
  seasonEntry: number;
  venmo: string;
  pot: number;
  season: number;
  createdAt: Timestamp | null;
  memberCount: number;
  status: LeagueStatus;
};

export type MemberRole = 'commissioner' | 'member';

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
};
