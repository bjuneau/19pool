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
import { EntryFeeCard } from '../components/EntryFeeCard';
import { Input } from '../components/Input';
import { Modal, ModalCancel, ModalDestructive } from '../components/Modal';
import { PasswordStrengthBar } from '../components/PasswordStrengthBar';
import { useAuth, authErrorMessage } from '../lib/auth';
import { db } from '../lib/firebase';
import {
  buildDisplayName,
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
  venmo?: string;
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
  const [profileVenmo, setProfileVenmo] = useState('');
  const [profileStatus, setProfileStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Password state ─────────────────────────────────────────────────────────

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStatus, setPwStatus] = useState<SaveStatus>({ kind: 'idle' });

  // ── Leave league state (member-only) ───────────────────────────────────────

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveStatus, setLeaveStatus] = useState<SaveStatus>({ kind: 'idle' });

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
      setProfileVenmo((cur) => (cur ? cur : ud.venmo ?? ''));
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
    profileLastName !== (userDoc?.lastName ?? '') ||
    profileVenmo.trim() !== (userDoc?.venmo ?? '');

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
    // Venmo: strip leading @, whitespace. Handles are case-insensitive on
    // Venmo but we preserve what the user typed for display.
    const newVenmo = profileVenmo.trim().replace(/^@/, '');
    const newName = buildDisplayName(newFirst, newLast, user.email?.split('@')[0]);

    try {
      // 1. User doc — source of truth for the user's own identity.
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: newFirst,
        lastName: newLast,
        name: newName,
        venmo: newVenmo,
      });

      // 2. Member doc — keeps the standings/members list + Payments tab in sync.
      if (myMember && leagueCode) {
        await updateDoc(doc(db, 'leagues', leagueCode, 'members', myMember.id), {
          firstName: newFirst,
          lastName: newLast,
          name: newName,
          venmo: newVenmo,
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
      <div className="bg-paper min-h-screen flex items-center justify-center text-ink-dim text-sm">
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

  const showMemberLeagueCards = !isCommissioner && !!league;
  const canLeave = league?.status === 'recruiting';

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto px-5 sm:px-8 max-w-5xl">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-navy-900 border border-amber-500/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
            {toast}
          </div>
        )}

        {/* Masthead matches Dashboard — same hairline rule, same
            wordmark, "← Dashboard" on the right in place of the
            person icon that dashboard uses to reach this page. */}
        <header className="flex items-center justify-between h-14 border-b border-ink-line">
          <Link to="/" className="flex items-baseline">
            <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-accent">
              19
            </span>
            <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-ink">
              POOL
            </span>
          </Link>
          <Link
            to="/dashboard"
            className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
          >
            ← Dashboard
          </Link>
        </header>

        <div className="py-4 sm:py-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-extrabold text-white mb-8 tracking-tight">
              Account
            </h1>

            <div className="space-y-6">
              {/* ── Profile ────────────────────────────────────────────── */}
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
                  <div>
                    <Input
                      label="Venmo Handle (optional)"
                      type="text"
                      placeholder="your-handle"
                      autoComplete="off"
                      value={profileVenmo}
                      onChange={(e) => setProfileVenmo(e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Used for entry-fee Venmo requests in your league.
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

              {/* ── Security ───────────────────────────────────────────── */}
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

              {/* ── Member-only: league identity + leave + entry fee ────
                  Commissioners see this content under Admin → League on
                  the dashboard instead. */}
              {showMemberLeagueCards && league && (
                <>
                  <Card>
                    <h2 className="text-xl font-bold text-white mb-1">League</h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Your league membership and role.
                    </p>

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
                          <span className="text-white font-semibold">Member</span>
                        </p>
                      </div>

                      {canLeave ? (
                        <button
                          type="button"
                          onClick={() => {
                            setLeaveStatus({ kind: 'idle' });
                            setLeaveOpen(true);
                          }}
                          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors"
                        >
                          Leave League
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          {league.status === 'in_season'
                            ? "You can't leave once the league is in season."
                            : league.status === 'complete'
                              ? 'This league is finished — leaving is no longer possible.'
                              : "You can't leave after teams are assigned."}
                        </p>
                      )}
                    </div>
                  </Card>

                  <EntryFeeCard
                    league={league}
                    leagueCode={leagueCode}
                    isCommissioner={false}
                    onToast={showToast}
                  />
                </>
              )}

              {/* ── Not in a league yet — shown to everyone without one ─ */}
              {!league && (
                <Card>
                  <h2 className="text-xl font-bold text-white mb-1">League</h2>
                  <div className="text-slate-400 text-sm mt-4">
                    You're not in a league yet.{' '}
                    <Link
                      to="/create-league"
                      className="text-amber-400 hover:text-amber-300"
                    >
                      Create one
                    </Link>{' '}
                    or join one with an invite link.
                  </div>
                </Card>
              )}

              {/* ── Danger zone — Delete Account only ──────────────────── */}
              <Card>
                <h2 className="text-xl font-bold text-white mb-1">Danger Zone</h2>
                <p className="text-sm text-slate-400 mb-6">
                  Permanently delete your account.
                </p>

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
              </Card>

              {/* ── Sign out — routine action, sits at the bottom on its
                  own so it doesn't get confused with Delete Account. */}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
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
