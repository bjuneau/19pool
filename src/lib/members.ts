import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { LEAGUE_CAPACITY, normalizeLeague } from './types';
import type { League, Member, MemberRole } from './types';
import { buildInviteEmailHtml, buildInviteEmailSubject } from './inviteEmail';

export type MemberWithId = Member & { id: string };

/**
 * Thrown by createPendingInvite when a member with the same email already
 * exists in the league. Callers can catch this specifically to treat it as a
 * skip rather than a failure.
 */
export class MemberExistsError extends Error {
  constructor(public existing: MemberWithId) {
    super('A member with this email already exists in this league.');
    this.name = 'MemberExistsError';
  }
}

export function generateInviteToken(): string {
  // 32 hex chars, dashes stripped — opaque, hard to guess.
  return crypto.randomUUID().replace(/-/g, '');
}

export function buildDisplayName(firstName: string, lastName: string, fallback?: string): string {
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;
  if (fallback) return fallback;
  return 'Member';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Pulls and lightly normalizes the member list for a league.
export async function listMembers(leagueCode: string): Promise<MemberWithId[]> {
  const snap = await getDocs(collection(db, 'leagues', leagueCode, 'members'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Member) }));
}

// Sort: commissioner first, then joined ascending, then pending (joinedAt
// null) ascending by invitedAt.
export function sortMembers(members: MemberWithId[]): MemberWithId[] {
  return [...members].sort((a, b) => {
    if (a.role === 'commissioner' && b.role !== 'commissioner') return -1;
    if (b.role === 'commissioner' && a.role !== 'commissioner') return 1;
    const aPending = a.joinedAt == null;
    const bPending = b.joinedAt == null;
    if (aPending !== bPending) return aPending ? 1 : -1;
    if (!aPending && !bPending) {
      return (a.joinedAt?.toMillis?.() ?? 0) - (b.joinedAt?.toMillis?.() ?? 0);
    }
    return (a.invitedAt?.toMillis?.() ?? 0) - (b.invitedAt?.toMillis?.() ?? 0);
  });
}

type CreateInviteArgs = {
  leagueCode: string;
  email: string;
  role?: MemberRole;
};

// Writes a pending invite (uid: null, joinedAt: null) and returns the new doc.
// Caller is responsible for capacity checks and the email send.
export async function createPendingInvite({
  leagueCode,
  email,
  role = 'member',
}: CreateInviteArgs): Promise<MemberWithId> {
  const lower = email.trim().toLowerCase();

  const existing = await findMemberByEmail(leagueCode, lower);
  if (existing) {
    throw new MemberExistsError(existing);
  }

  const member: Member = {
    uid: null,
    email: lower,
    firstName: '',
    lastName: '',
    name: lower,
    phone: '',
    teams: [],
    wins: 0,
    closest: 0,
    role,
    invitedAt: null,
    joinedAt: null,
    inviteToken: generateInviteToken(),
    lastInviteSentAt: null,
  };
  const ref = doc(collection(db, 'leagues', leagueCode, 'members'));
  await setDoc(ref, { ...member, invitedAt: serverTimestamp() });
  return { id: ref.id, ...member };
}

// Returns the member doc whose lowercased email matches, or null.
export async function findMemberByEmail(
  leagueCode: string,
  email: string
): Promise<MemberWithId | null> {
  const lower = email.trim().toLowerCase();
  const q = query(
    collection(db, 'leagues', leagueCode, 'members'),
    where('email', '==', lower),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Member) };
}

// Resolves a join URL to a league + (optionally) the specific invited member.
// URL contract:
//   /join/CODE                  → shared link, returns league with invitedMember=null
//   /join/CODE?invite=TOKEN     → email invite, returns league + the matching member
//
// We deliberately do NOT use a collectionGroup query — that would require a
// manually-created Firestore index. The token lookup runs scoped to a single
// league's members subcollection, which uses Firestore's auto-index.
export type ResolvedInvite = {
  leagueCode: string;
  league: League;
  invitedMember: MemberWithId | null;
};

export async function resolveInvite(
  code: string,
  inviteToken?: string | null
): Promise<ResolvedInvite | null> {
  const trimmedCode = code.trim();
  if (!trimmedCode) return null;

  const upperCode = trimmedCode.toUpperCase();
  const leagueSnap = await getDoc(doc(db, 'leagues', upperCode));
  if (!leagueSnap.exists()) return null;
  const league = normalizeLeague(leagueSnap.data() as Record<string, unknown>);

  const trimmedToken = inviteToken?.trim();
  if (trimmedToken) {
    const tokenQuery = query(
      collection(db, 'leagues', upperCode, 'members'),
      where('inviteToken', '==', trimmedToken),
      limit(1)
    );
    const memberSnap = await getDocs(tokenQuery);
    if (memberSnap.empty) return null;
    const memberDoc = memberSnap.docs[0];
    return {
      leagueCode: upperCode,
      league,
      invitedMember: { id: memberDoc.id, ...(memberDoc.data() as Member) },
    };
  }

  return { leagueCode: upperCode, league, invitedMember: null };
}

export type ClaimResult =
  | { ok: true; alreadyMember: boolean }
  | { ok: false; error: string };

type ClaimArgs = {
  leagueCode: string;
  league: League;
  invitedMember: MemberWithId | null;
  user: User;
  // For a brand-new sign-up the user doc may have just been written; pass the
  // values so we can backfill the member record with their real name.
  firstName?: string;
  lastName?: string;
};

// Claim an existing pending invite if one matches, otherwise create a new
// member doc. Honors capacity for new members but lets pending claims through
// even when the league is at capacity (the spot was already allocated).
export async function claimOrCreateMember(args: ClaimArgs): Promise<ClaimResult> {
  const { leagueCode, league, invitedMember, user, firstName = '', lastName = '' } = args;
  const userEmail = (user.email ?? '').toLowerCase();
  if (!userEmail) {
    return { ok: false, error: 'Your account is missing an email address.' };
  }

  // Hard gate: no joins after the season starts.
  if (league.status === 'in_season') {
    return {
      ok: false,
      error:
        'This league has already started. Contact the commissioner if you think you should be included.',
    };
  }

  // Case 1 — invite token resolved to a specific member doc.
  if (invitedMember) {
    if (invitedMember.uid && invitedMember.uid !== user.uid) {
      return { ok: false, error: 'This invite was sent to a different account.' };
    }
    if (invitedMember.uid === user.uid && invitedMember.joinedAt) {
      await ensureUserLeagueLink(user.uid, leagueCode);
      return { ok: true, alreadyMember: true };
    }
    await backfillMember({
      leagueCode,
      memberId: invitedMember.id,
      uid: user.uid,
      email: userEmail,
      firstName: firstName || invitedMember.firstName,
      lastName: lastName || invitedMember.lastName,
    });
    await ensureUserLeagueLink(user.uid, leagueCode);
    await bumpLeagueOnJoin(leagueCode, league.status);
    return { ok: true, alreadyMember: false };
  }

  // Case 2 — shared-link path. Look for an existing member by email.
  const existing = await findMemberByEmail(leagueCode, userEmail);
  if (existing) {
    if (existing.uid === user.uid && existing.joinedAt) {
      await ensureUserLeagueLink(user.uid, leagueCode);
      return { ok: true, alreadyMember: true };
    }
    if (existing.uid && existing.uid !== user.uid) {
      return { ok: false, error: 'Another account already claimed this invite.' };
    }
    await backfillMember({
      leagueCode,
      memberId: existing.id,
      uid: user.uid,
      email: userEmail,
      firstName: firstName || existing.firstName,
      lastName: lastName || existing.lastName,
    });
    await ensureUserLeagueLink(user.uid, leagueCode);
    await bumpLeagueOnJoin(leagueCode, league.status);
    return { ok: true, alreadyMember: false };
  }

  // Case 3 — brand new member via shared link. Capacity gate applies here.
  if (league.memberCount >= LEAGUE_CAPACITY) {
    return { ok: false, error: 'This league is full.' };
  }

  // Race guard: another tab/device may have created the doc between the
  // findMemberByEmail above and now. Treat a late duplicate as already joined.
  const raceCheck = await findMemberByEmail(leagueCode, userEmail);
  if (raceCheck) {
    await ensureUserLeagueLink(user.uid, leagueCode);
    return { ok: true, alreadyMember: true };
  }

  const newMember: Member = {
    uid: user.uid,
    email: userEmail,
    firstName,
    lastName,
    name: buildDisplayName(firstName, lastName, userEmail.split('@')[0]),
    phone: '',
    teams: [],
    wins: 0,
    closest: 0,
    role: 'member',
    invitedAt: null,
    joinedAt: null,
    inviteToken: generateInviteToken(),
    lastInviteSentAt: null,
  };
  const ref = doc(collection(db, 'leagues', leagueCode, 'members'));
  await setDoc(ref, {
    ...newMember,
    invitedAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });
  await ensureUserLeagueLink(user.uid, leagueCode);
  await bumpLeagueOnJoin(leagueCode, league.status);
  return { ok: true, alreadyMember: false };
}

async function backfillMember(args: {
  leagueCode: string;
  memberId: string;
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  const { leagueCode, memberId, uid, email, firstName, lastName } = args;
  const ref = doc(db, 'leagues', leagueCode, 'members', memberId);
  await updateDoc(ref, {
    uid,
    email,
    firstName,
    lastName,
    name: buildDisplayName(firstName, lastName, email.split('@')[0]),
    joinedAt: serverTimestamp(),
  });
}

async function ensureUserLeagueLink(uid: string, leagueCode: string) {
  await updateDoc(doc(db, 'users', uid), { leagueCode });
}

// Single atomic update that always increments memberCount and, when the league
// is already in 'assigned' state, simultaneously resets skipReassignmentCheck.
// The Firestore rule requires both fields to land in one write when status is
// 'assigned' (affectedKeys must be exactly ['memberCount','skipReassignmentCheck']).
async function bumpLeagueOnJoin(leagueCode: string, leagueStatus: string) {
  const update: Record<string, unknown> = { memberCount: increment(1) };
  if (leagueStatus === 'assigned') {
    update.skipReassignmentCheck = false;
  }
  await updateDoc(doc(db, 'leagues', leagueCode), update);
}

// Convenience for the dashboard "Send Email Invite" flow. Calls the existing
// /api/send-email serverless function.
export async function sendInviteEmail(args: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to send invite (${res.status})`);
  }
}

// ─── Resend ───────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export type ResendResult =
  | { ok: true }
  | { ok: false; reason: 'cooldown' | 'joined' | 'error'; error?: string; retryAt?: Date };

/**
 * Resends an invite email to a pending member. Enforces:
 *  • already-joined guard
 *  • 1-hour per-recipient cooldown (based on lastInviteSentAt)
 * Reuses the existing inviteToken — both the old and new links keep working.
 * On success, writes lastInviteSentAt = serverTimestamp() to the member doc.
 */
export async function resendInvite(
  member: MemberWithId,
  league: League,
  leagueCode: string,
  commissionerEmail: string
): Promise<ResendResult> {
  // 1. Refuse if already joined.
  if (member.joinedAt) return { ok: false, reason: 'joined' };

  // 2. Cooldown check. undefined/null means "never sent" — allow immediately.
  if (member.lastInviteSentAt) {
    const sentAt = member.lastInviteSentAt.toDate();
    const cutoff = new Date(Date.now() - RESEND_COOLDOWN_MS);
    if (sentAt > cutoff) {
      const retryAt = new Date(sentAt.getTime() + RESEND_COOLDOWN_MS);
      return { ok: false, reason: 'cooldown', retryAt };
    }
  }

  // 3. Build and send email using the existing token (not a new one).
  const inviteUrl = `${window.location.origin}/join/${leagueCode}?invite=${member.inviteToken}`;
  const html = buildInviteEmailHtml({
    leagueName: league.name,
    leagueCode,
    commissionerName: league.commissionerName ?? '',
    inviteUrl,
  });
  const subject = buildInviteEmailSubject(league.commissionerName ?? '', league.name);

  try {
    await sendInviteEmail({ to: member.email, subject, html, replyTo: commissionerEmail });
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      error: (err as { message?: string })?.message ?? 'Send failed',
    };
  }

  // 4. Stamp the send time so the cooldown takes effect.
  await updateDoc(doc(db, 'leagues', leagueCode, 'members', member.id), {
    lastInviteSentAt: serverTimestamp(),
  });

  return { ok: true };
}

/** Returns true if the member is within the 1-hour resend cooldown. */
export function isInResendCooldown(member: Pick<Member, 'lastInviteSentAt'>): boolean {
  if (!member.lastInviteSentAt) return false;
  const sentAt = member.lastInviteSentAt.toDate();
  return sentAt > new Date(Date.now() - RESEND_COOLDOWN_MS);
}

/** Returns the Date when the cooldown expires, or null if not in cooldown. */
export function resendCooldownExpiresAt(
  member: Pick<Member, 'lastInviteSentAt'>
): Date | null {
  if (!member.lastInviteSentAt) return null;
  const sentAt = member.lastInviteSentAt.toDate();
  const expiresAt = new Date(sentAt.getTime() + RESEND_COOLDOWN_MS);
  return expiresAt > new Date() ? expiresAt : null;
}

// Convenience: re-export ordering helper that callers can apply to a fresh
// listMembers() result.
export { LEAGUE_CAPACITY } from './types';

// Also re-export an ordered query used by the Members tab via onSnapshot.
export function membersCollectionRef(leagueCode: string) {
  return query(
    collection(db, 'leagues', leagueCode, 'members'),
    orderBy('invitedAt', 'asc')
  );
}
