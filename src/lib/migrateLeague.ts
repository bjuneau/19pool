import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateInviteToken } from './members';
import type { Member } from './types';

type LegacyMember = {
  uid?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  team?: string;
  wins?: number;
  closest?: number;
};

// One-shot helper to migrate a legacy league (members[] array on the parent
// doc) to the new members subcollection. Idempotent: skips if no `members`
// field is present.
//
// Exposed on window.migrateLeagueToSubcollection so it can be invoked from
// the browser console while signed in as the commissioner. Not auto-run.
export async function migrateLeagueToSubcollection(leagueCode: string): Promise<{
  migrated: number;
  status: 'already_migrated' | 'migrated' | 'not_found';
}> {
  const code = leagueCode.trim().toUpperCase();
  const leagueRef = doc(db, 'leagues', code);
  const snap = await getDoc(leagueRef);
  if (!snap.exists()) {
    return { migrated: 0, status: 'not_found' };
  }
  const data = snap.data() as Record<string, unknown>;
  const members = data.members;
  if (!Array.isArray(members)) {
    return { migrated: 0, status: 'already_migrated' };
  }

  const commissionerId = data.commissionerId as string | undefined;
  const createdAt = data.createdAt;

  let migratedCount = 0;
  for (const old of members as LegacyMember[]) {
    const email = (old.email ?? '').toLowerCase();
    const firstName = old.firstName ?? '';
    const lastName = old.lastName ?? '';
    const teams =
      old.team && old.team !== 'Unassigned' && old.team.trim() ? [old.team] : [];

    const member: Member = {
      uid: old.uid ?? null,
      email,
      firstName,
      lastName,
      name: old.name ?? (`${firstName} ${lastName}`.trim() || email),
      phone: old.phone ?? '',
      teams,
      wins: typeof old.wins === 'number' ? old.wins : 0,
      closest: typeof old.closest === 'number' ? old.closest : 0,
      role: old.uid && old.uid === commissionerId ? 'commissioner' : 'member',
      // Use the league's createdAt for both timestamps so existing members
      // appear "already joined" in the new sort order.
      invitedAt: (createdAt as Member['invitedAt']) ?? null,
      joinedAt: (createdAt as Member['joinedAt']) ?? null,
      inviteToken: generateInviteToken(),
      lastInviteSentAt: null,
    };

    const newRef = doc(collection(db, 'leagues', code, 'members'));
    await setDoc(newRef, member);
    migratedCount++;
  }

  // Strip the now-stale members[] array; add memberCount + status if missing.
  await updateDoc(leagueRef, {
    members: deleteField(),
    memberCount: migratedCount,
    status: data.status ?? 'recruiting',
  });

  return { migrated: migratedCount, status: 'migrated' };
}
