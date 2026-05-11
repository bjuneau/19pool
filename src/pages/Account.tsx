import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PasswordStrengthBar } from '../components/PasswordStrengthBar';
import { useAuth, authErrorMessage } from '../lib/auth';
import { db } from '../lib/firebase';
import {
  buildDisplayName,
  deleteLeague as deleteLeagueHelper,
  leaveLeague as leaveLeagueHelper,
} from '../lib/members';
import type { MemberWithId } from '../lib/members';
import { getPasswordStrength } from '../lib/passwordStrength';
import { normalizeLeague } from '../lib/types';
import type { League, LeagueStatus } from '../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserDoc = {
  firstName?: string;
  lastName?: string;
  email?: string;
  leagueCode?: string;
};

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusPill(status: LeagueStatus): { label: string; className: string } {
  switch (status) {
    case 'recruiting':
      return {
        label: 'Recruiting',
        className: 'bg-white/5 text-slate-300 border border-white/10',
      };
    case 'assigned':
      return {
        label: 'Teams Assigned',
        className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      };
    case 'in_season':
      return {
        label: 'In Season',
        className: 'bg-green-500/15 text-green-400 border border-green-500/30',
      };
    case 'complete':
      return {
        label: 'Complete',
        className: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
      };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leagueCode, setLeagueCode] = useState<string>('');
  const [myMember, setMyMember] = useState<MemberWithId | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Toast
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  // ── Profile state ──────────────────────────────────────────────────────────

  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileStatus, setProfileStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Password state ─────────────────────────────────────────────────────────

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStatus, setPwStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Leave league state ─────────────────────────────────────────────────────

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveStatus, setLeaveStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Delete league state ────────────────────────────────────────────────────

  const [deleteLeagueOpen, setDeleteLeagueOpen] = useState(false);
  const [deleteLeagueTyped, setDeleteLeagueTyped] = useState('');
  const [deleteLeagueStatus, setDeleteLeagueStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Delete account state ───────────────────────────────────────────────────

  const [deleteAcctOpen, setDeleteAcctOpen] = useState(false);
  const [deleteAcctTyped, setDeleteAcctTyped] = useState('');
  const [deleteAcctPw, setDeleteAcctPw] = useState('');
  const [deleteAcctStatus, setDeleteAcctStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Subscriptions ──────────────────────────────────────────────────────────

  // Subscribe to the user's own doc.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const ud = (snap.exists() ? snap.data() : {}) as UserDoc;
      setUserDoc(ud);
      setLeagueCode(ud.leagueCode ?? '');
      // Seed profile fields once when the user doc arrives. We don't keep
      // these in sync with the snapshot because the user might be typing —
      // overwriting their input would be jarring.
      setProfileFirstName((cur) => (cur ? cur : ud.firstName ?? ''));
      setProfileLastName((cur) => (cur ? cur : ud.lastName ?? ''));
      setLoadingProfile(false);
    });
    return unsub;
  }, [user]);

  // Subscribe to the user's league.
  useEffect(() => {
    if (!leagueCode) {
      setLeague(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'leagues', leagueCode), (snap) => {
      setLeague(
        snap.exists() ? normalizeLeague(snap.data() as Record<string, unknown>) : null
      );
    });
    return unsub;
  }, [leagueCode]);

  // Subscribe to the user's own member doc within the league. We need it for
  // self-leave and to keep the per-member name in sync on profile edits.
  useEffect(() => {
    if (!user || !leagueCode) {
      setMyMember(null);
      return;
    }
    const q = query(
      collection(db, 'leagues', leagueCode, 'members'),
      where('uid', '==', user.uid),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setMyMember(null);
      } else {
        const d = snap.docs[0];
        setMyMember({ id: d.id, ...(d.data() as Omit<MemberWithId, 'id'>) });
      }
    });
    return unsub;
  }, [user, leagueCode]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isCommissioner =
    !!user && !!league && league.commissionerId === user.uid;

  const profileDirty =
    profileFirstName !== (userDoc?.firstName ?? '') ||
    profileLastName !== (userDoc?.lastName ?? '');

  const newPwStrength = useMemo(() => getPasswordStrength(pwNew), [pwNew]);

  const passwordReady =
    pwCurrent.length > 0 &&
    pwNew.length >= 8 &&
    pwNew === pwConfirm &&
    pwNew !== pwCurrent &&
    newPwStrength.score >= 2;

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!profileDirty) return;
    setProfileStatus({ kind: 'saving' });

    const newFirst = profileFirstName.trim();
    const newLast = profileLastName.trim();
    const newName = buildDisplayName(newFirst, newLast, user.email?.split('@')[0]);

    try {
      // 1. User doc — source of truth for the user's own identity.
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: newFirst,
        lastName: newLast,
        name: newName,
      });

      // 2. Member doc — keeps the standings/members list in sync.
      if (myMember && leagueCode) {
        await updateDoc(doc(db, 'leagues', leagueCode, 'members', myMember.id), {
          firstName: newFirst,
          lastName: newLast,
          name: newName,
        });
      }

      // 3. Denormalized commissionerName, if applicable.
      if (isCommissioner && leagueCode) {
        await updateDoc(doc(db, 'leagues', leagueCode), {
          commissionerName: newName,
        });
      }

      setProfileStatus({ kind: 'idle' });
      showToast('✓ Profile updated.');
    } catch (err) {
      setProfileStatus({
        kind: 'error',
        message: (err as { message?: string })?.message ?? 'Save failed.',
      });
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!user || !user.email) return;
    if (!passwordReady) return;
    setPwStatus({ kind: 'saving' });

    try {
      const cred = EmailAuthProvider.credential(user.email, pwCurrent);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwNew);
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      setPwStatus({ kind: 'idle' });
      showToast('✓ Password changed.');
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const message =
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : authErrorMessage(err);
      setPwStatus({ kind: 'error', message });
    }
  }

  async function handleLeaveLeague() {
    if (!myMember || !league || !leagueCode) return;
    setLeaveStatus({ kind: 'saving' });
    const result = await leaveLeagueHelper(myMember, league, leagueCode);
    if (!result.ok) {
      const message =
        result.reason === 'locked'
          ? "You can't leave once the league has moved past recruiting."
          : result.reason === 'commissioner'
            ? "Commissioners can't leave — delete the league instead."
            : result.error ?? 'Leave failed.';
      setLeaveStatus({ kind: 'error', message });
      return;
    }
    setLeaveOpen(false);
    setLeaveStatus({ kind: 'idle' });
    showToast('✓ Left the league.');
    navigate('/dashboard', { replace: true });
  }

  async function handleDeleteLeague() {
    if (!league || !leagueCode) return;
    if (deleteLeagueTyped !== league.name) return;
    setDeleteLeagueStatus({ kind: 'saving' });
    const result = await deleteLeagueHelper(league, leagueCode);
    if (!result.ok) {
      const message =
        result.reason === 'locked'
          ? "You can't delete a league while it's in season."
          : result.error ?? 'Delete failed.';
      setDeleteLeagueStatus({ kind: 'error', message });
      return;
    }
    setDeleteLeagueOpen(false);
    setDeleteLeagueStatus({ kind: 'idle' });
    setDeleteLeagueTyped('');
    showToast('✓ League deleted.');
    navigate('/dashboard', { replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  async function handleDeleteAccount() {
    if (!user || !user.email) return;
    if (deleteAcctTyped !== 'DELETE') return;
    if (!deleteAcctPw) return;
    setDeleteAcctStatus({ kind: 'saving' });

    try {
      // 1. Re-auth with current password.
      const cred = EmailAuthProvider.credential(user.email, deleteAcctPw);
      await reauthenticateWithCredential(user, cred);

      // 2. Fresh ID token. The `true` forces a refresh so the server-side
      //    verifyIdToken(token, /*checkRevoked*/ true) accepts it.
      const idToken = await user.getIdToken(true);

      // 3. Server cascade — clears membership, deletes user doc + auth user.
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data: { error?: string; leagueName?: string } = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error === 'commissioner'
            ? `You're the commissioner of ${data.leagueName ?? 'a league'}. Delete the league first.`
            : data.error ?? `Server error (${res.status}).`;
        setDeleteAcctStatus({ kind: 'error', message });
        return;
      }

      // 4. Local auth state cleanup. The Auth account is already gone, but
      //    signOut() drops the client-side user so the listener resolves
      //    to null instead of a ghost.
      await signOut().catch(() => undefined);

      // 5. Out.
      navigate('/', { replace: true });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const message =
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : authErrorMessage(err);
      setDeleteAcctStatus({ kind: 'error', message });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((s) => !s)}
      className="text-slate-400 hover:text-amber-400 transition-colors text-xs font-medium"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? 'Hide' : 'Show'}
    </button>
  );

  return (
    <div className="hero-bg min-h-screen px-4 py-16">
      <div className="mx-auto max-w-2xl">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-navy-900 border border-amber-500/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
            {toast}
          </div>
        )}

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="text-2xl font-extrabold tracking-widest">
            <span className="text-amber-400">19</span>
            <span className="text-white"> POOL</span>
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Dashboard
          </Link>
        </header>

        <h1 className="text-3xl font-extrabold text-white mb-8 tracking-tight">
          Account
        </h1>

        <div className="space-y-6">
          {/* ── Profile ──────────────────────────────────────────────────── */}
          <Card>
            <h2 className="text-xl font-bold text-white mb-1">Profile</h2>
            <p className="text-sm text-slate-400 mb-6">
              Your name across the league.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  type="text"
                  autoComplete="given-name"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  type="text"
                  autoComplete="family-name"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Email"
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="opacity-60 cursor-not-allowed"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Email can't be changed.
                </p>
              </div>

              {profileStatus.kind === 'error' && (
                <p className="text-sm text-red-400">{profileStatus.message}</p>
              )}

              <button
                type="submit"
                disabled={!profileDirty || profileStatus.kind === 'saving'}
                className="bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 px-6 rounded-xl transition-all tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileStatus.kind === 'saving' ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </Card>

          {/* ── Security ─────────────────────────────────────────────────── */}
          <Card>
            <h2 className="text-xl font-bold text-white mb-1">Security</h2>
            <p className="text-sm text-slate-400 mb-6">Change your password.</p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                endAdornment={passwordToggle}
              />
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                endAdornment={passwordToggle}
              />
              <PasswordStrengthBar password={pwNew} strength={newPwStrength} />
              <Input
                label="Confirm New Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                endAdornment={passwordToggle}
              />

              {pwNew && pwConfirm && pwNew !== pwConfirm && (
                <p className="text-sm text-red-400">Passwords don't match.</p>
              )}
              {pwNew && pwCurrent && pwNew === pwCurrent && (
                <p className="text-sm text-red-400">
                  New password must be different from the current one.
                </p>
              )}
              {pwStatus.kind === 'error' && (
                <p className="text-sm text-red-400">{pwStatus.message}</p>
              )}

              <button
                type="submit"
                disabled={!passwordReady || pwStatus.kind === 'saving'}
                className="bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 px-6 rounded-xl transition-all tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwStatus.kind === 'saving' ? 'Updating…' : 'Change Password'}
              </button>
            </form>
          </Card>

          {/* ── League ───────────────────────────────────────────────────── */}
          <Card>
            <h2 className="text-xl font-bold text-white mb-1">League</h2>
            <p className="text-sm text-slate-400 mb-6">
              Your league membership and role.
            </p>

            {!league ? (
              <div className="text-slate-400 text-sm">
                You're not in a league yet.{' '}
                <Link to="/create-league" className="text-amber-400 hover:text-amber-300">
                  Create one
                </Link>{' '}
                or join one with an invite link.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-navy-950/60 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-lg truncate">
                        {league.name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {leagueCode}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusPill(league.status).className}`}
                    >
                      {statusPill(league.status).label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-3">
                    Role:{' '}
                    <span className="text-white font-semibold">
                      {isCommissioner ? 'Commissioner' : 'Member'}
                    </span>
                  </p>
                </div>

                {/* Member actions */}
                {!isCommissioner && (
                  <LeagueAction
                    enabled={league.status === 'recruiting'}
                    enabledLabel="Leave League"
                    disabledLabel={
                      league.status === 'in_season'
                        ? "You can't leave once the league is in season."
                        : league.status === 'complete'
                          ? 'This league is finished — leaving is no longer possible.'
                          : "You can't leave after teams are assigned."
                    }
                    onClick={() => {
                      setLeaveStatus({ kind: 'idle' });
                      setLeaveOpen(true);
                    }}
                  />
                )}

                {/* Commissioner actions */}
                {isCommissioner && (
                  <LeagueAction
                    enabled={league.status !== 'in_season'}
                    enabledLabel="Delete League"
                    disabledLabel="You can't delete a league while it's in season."
                    destructive
                    onClick={() => {
                      setDeleteLeagueStatus({ kind: 'idle' });
                      setDeleteLeagueTyped('');
                      setDeleteLeagueOpen(true);
                    }}
                  />
                )}
              </div>
            )}
          </Card>

          {/* ── Danger zone ──────────────────────────────────────────────── */}
          <Card>
            <h2 className="text-xl font-bold text-white mb-1">Danger Zone</h2>
            <p className="text-sm text-slate-400 mb-6">
              Sign out or permanently delete your account.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Sign Out
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteAcctStatus({ kind: 'idle' });
                  setDeleteAcctTyped('');
                  setDeleteAcctPw('');
                  setDeleteAcctOpen(true);
                }}
                className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-3 rounded-xl transition-colors"
              >
                Delete Account
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Leave league modal ──────────────────────────────────────────── */}
      {leaveOpen && league && (
        <Modal onClose={() => leaveStatus.kind !== 'saving' && setLeaveOpen(false)}>
          <h2 className="text-white font-bold text-lg mb-3">
            Leave {league.name}?
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            You'll be removed from the league. You can join a different league after.
          </p>
          {leaveStatus.kind === 'error' && (
            <p className="text-red-400 text-sm mb-4">{leaveStatus.message}</p>
          )}
          <div className="flex gap-3">
            <ModalCancel
              disabled={leaveStatus.kind === 'saving'}
              onClick={() => setLeaveOpen(false)}
            />
            <ModalDestructive
              disabled={leaveStatus.kind === 'saving'}
              onClick={() => void handleLeaveLeague()}
              label={leaveStatus.kind === 'saving' ? 'Leaving…' : 'Leave League'}
            />
          </div>
        </Modal>
      )}

      {/* ── Delete league modal (typed confirmation) ────────────────────── */}
      {deleteLeagueOpen && league && (
        <Modal
          onClose={() =>
            deleteLeagueStatus.kind !== 'saving' && setDeleteLeagueOpen(false)
          }
        >
          <h2 className="text-white font-bold text-lg mb-3">Delete this league?</h2>
          <p className="text-slate-400 text-sm mb-4">
            This permanently deletes the league and removes all members. This
            cannot be undone.
          </p>
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1.5">
              Type{' '}
              <span className="text-white font-mono font-semibold">
                {league.name}
              </span>{' '}
              to confirm:
            </p>
            <input
              type="text"
              value={deleteLeagueTyped}
              onChange={(e) => setDeleteLeagueTyped(e.target.value)}
              autoFocus
              className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-2.5 rounded-xl text-sm"
            />
          </div>
          {deleteLeagueStatus.kind === 'error' && (
            <p className="text-red-400 text-sm mb-4">
              {deleteLeagueStatus.message}
            </p>
          )}
          <div className="flex gap-3">
            <ModalCancel
              disabled={deleteLeagueStatus.kind === 'saving'}
              onClick={() => setDeleteLeagueOpen(false)}
            />
            <ModalDestructive
              disabled={
                deleteLeagueTyped !== league.name ||
                deleteLeagueStatus.kind === 'saving'
              }
              onClick={() => void handleDeleteLeague()}
              label={
                deleteLeagueStatus.kind === 'saving' ? 'Deleting…' : 'Delete League'
              }
            />
          </div>
        </Modal>
      )}

      {/* ── Delete account modal ─────────────────────────────────────────── */}
      {deleteAcctOpen && (
        <Modal
          onClose={() =>
            deleteAcctStatus.kind !== 'saving' && setDeleteAcctOpen(false)
          }
        >
          <h2 className="text-white font-bold text-lg mb-3">Delete your account?</h2>
          <p className="text-slate-400 text-sm mb-3">
            This permanently deletes your account and all associated data. This
            cannot be undone.
          </p>
          <ul className="text-sm text-slate-400 mb-5 space-y-1 list-disc list-inside">
            <li>You'll be removed from any league you're a member of</li>
            <li>
              If you're a commissioner of a league, that league must be deleted first
            </li>
            <li>Your account, profile, and history will be permanently erased</li>
          </ul>

          <div className="space-y-3 mb-4">
            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                Type{' '}
                <span className="text-white font-mono font-semibold">DELETE</span>{' '}
                to confirm:
              </p>
              <input
                type="text"
                value={deleteAcctTyped}
                onChange={(e) => setDeleteAcctTyped(e.target.value)}
                autoFocus
                className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-2.5 rounded-xl text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                Current password to re-authenticate:
              </p>
              <input
                type="password"
                value={deleteAcctPw}
                onChange={(e) => setDeleteAcctPw(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-2.5 rounded-xl text-sm"
              />
            </div>
          </div>

          {deleteAcctStatus.kind === 'error' && (
            <p className="text-red-400 text-sm mb-4">{deleteAcctStatus.message}</p>
          )}
          <div className="flex gap-3">
            <ModalCancel
              disabled={deleteAcctStatus.kind === 'saving'}
              onClick={() => setDeleteAcctOpen(false)}
            />
            <ModalDestructive
              disabled={
                deleteAcctTyped !== 'DELETE' ||
                !deleteAcctPw ||
                deleteAcctStatus.kind === 'saving'
              }
              onClick={() => void handleDeleteAccount()}
              label={
                deleteAcctStatus.kind === 'saving' ? 'Deleting…' : 'Delete Account'
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeagueAction({
  enabled,
  enabledLabel,
  disabledLabel,
  destructive = false,
  onClick,
}: {
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  if (!enabled) {
    return <p className="text-xs text-slate-500 italic">{disabledLabel}</p>;
  }
  const cls = destructive
    ? 'w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-3 rounded-xl transition-colors'
    : 'w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors';
  return (
    <button type="button" onClick={onClick} className={cls}>
      {enabledLabel}
    </button>
  );
}

function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function ModalCancel({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Cancel
    </button>
  );
}

function ModalDestructive({
  disabled,
  onClick,
  label,
}: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
