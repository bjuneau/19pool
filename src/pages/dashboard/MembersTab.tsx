import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  LEAGUE_CAPACITY,
  MemberExistsError,
  buildDisplayName,
  createManualMember,
  createPendingInvite,
  findMemberByEmail,
  isInResendCooldown,
  isValidEmail,
  membersCollectionRef,
  removeMember,
  resendCooldownExpiresAt,
  resendInvite,
  sendInviteEmail,
  sortMembers,
} from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import {
  buildInviteEmailHtml,
  buildInviteEmailSubject,
} from '../../lib/inviteEmail';
import type { League } from '../../lib/types';
import { db } from '../../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  leagueCode: string;
  league: League;
  commissionerName: string;
};

type InviteTab = 'email' | 'link' | 'manual';

type ManualStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

type SendStatus =
  | { kind: 'idle' }
  | { kind: 'sending'; current: number; total: number }
  | { kind: 'done'; sent: number; skipped: string[]; failed: { email: string; error: string }[] };

type MemberResendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'cooldown'; retryAt: Date };

type ResendAllStatus =
  | { kind: 'idle' }
  | { kind: 'sending'; current: number; total: number }
  | { kind: 'done'; sent: number; skipped: number; failed: number; errors: string[] };

// ─── Component ────────────────────────────────────────────────────────────────

export default function MembersTab({ leagueCode, league, commissionerName }: Props) {
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InviteTab>('link');
  const [emailsRaw, setEmailsRaw] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>({ kind: 'idle' });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Manual Add tab state — commissioner types first/last/email for a
  // player who isn't signing up on their own, so teams can be assigned
  // right away without waiting.
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualAlsoEmail, setManualAlsoEmail] = useState(false);
  const [manualStatus, setManualStatus] = useState<ManualStatus>({ kind: 'idle' });

  // Per-member resend state: memberId → state
  const [resendStates, setResendStates] = useState<Record<string, MemberResendState>>({});

  // Resend All state
  const [resendAllStatus, setResendAllStatus] = useState<ResendAllStatus>({ kind: 'idle' });
  const [showResendAllModal, setShowResendAllModal] = useState(false);

  // Removal state
  const [removeTarget, setRemoveTarget] = useState<MemberWithId | null>(null);
  const [removeStatus, setRemoveStatus] = useState<
    { kind: 'idle' } | { kind: 'removing' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // Edit-member state — commissioner fixing a name typo or bad email address
  // on a member doc. Doesn't touch Firebase Auth for joined members; a note
  // in the modal explains this.
  const [editTarget, setEditTarget] = useState<MemberWithId | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // Toast (success messages)
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  useEffect(() => {
    const unsub = onSnapshot(
      membersCollectionRef(leagueCode),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MemberWithId, 'id'>),
        }));
        setMembers(sortMembers(list));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [leagueCode]);

  const memberCount = members.length;
  const capacityPct = Math.min(100, (memberCount / LEAGUE_CAPACITY) * 100);
  const inviteUrl = useMemo(
    () => `${window.location.origin}/join/${leagueCode}`,
    [leagueCode]
  );
  // Web Share API is only exposed on browsers with a native share sheet
  // (essentially: mobile Safari, Android Chrome). On desktop it either
  // doesn't exist or opens a clunky OS-level dialog, so we hide the
  // prominent Share CTA there and let Copy Invite Link carry that flow.
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const knownEmails = useMemo(
    () => new Set(members.map((m) => m.email.toLowerCase())),
    [members]
  );

  // Pending members (haven't joined yet, not commissioner).
  const pendingMembers = useMemo(
    () => members.filter((m) => m.joinedAt == null && m.role !== 'commissioner'),
    [members]
  );

  // Pending members not currently in cooldown — the count shown in "Resend All" label.
  const sendablePendingCount = useMemo(
    () => pendingMembers.filter((m) => !isInResendCooldown(m)).length,
    [pendingMembers]
  );

  // ── Initial invite send ────────────────────────────────────────────────────

  async function handleSendInvites(e: FormEvent) {
    e.preventDefault();
    setSendStatus({ kind: 'idle' });

    const candidates = parseEmails(emailsRaw);
    const valid: string[] = [];
    const skipped: string[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const email of candidates) {
      if (!isValidEmail(email)) {
        failed.push({ email, error: 'Invalid email' });
      } else if (knownEmails.has(email)) {
        skipped.push(email);
      } else {
        valid.push(email);
      }
    }

    if (valid.length === 0 && failed.length === 0 && skipped.length === 0) {
      setSendStatus({
        kind: 'done',
        sent: 0,
        skipped: [],
        failed: [{ email: '', error: 'Please paste at least one email address.' }],
      });
      return;
    }

    let sent = 0;
    for (let i = 0; i < valid.length; i++) {
      const email = valid[i];
      setSendStatus({ kind: 'sending', current: i + 1, total: valid.length });
      try {
        const member = await createPendingInvite({ leagueCode, email });
        const tokenUrl = `${window.location.origin}/join/${leagueCode}?invite=${member.inviteToken}`;
        await sendInviteEmail({
          to: email,
          subject: buildInviteEmailSubject(commissionerName, league.name),
          html: buildInviteEmailHtml({
            leagueName: league.name,
            commissionerName,
            inviteUrl: tokenUrl,
            leagueCode,
          }),
          replyTo: league.commissionerEmail,
        });
        // Stamp the send time only on success so a failed initial send
        // doesn't burn the cooldown — user can retry immediately.
        await updateDoc(doc(db, 'leagues', leagueCode, 'members', member.id), {
          lastInviteSentAt: serverTimestamp(),
        });
        sent++;
      } catch (err) {
        if (err instanceof MemberExistsError) {
          skipped.push(email);
        } else {
          failed.push({
            email,
            error: (err as { message?: string })?.message ?? 'Send failed',
          });
        }
      }
    }

    setSendStatus({ kind: 'done', sent, skipped, failed });
    if (sent === valid.length && failed.length === 0) {
      setEmailsRaw('');
    }
  }

  // ── Manual add ────────────────────────────────────────────────────────────
  // Writes a joined member doc with no Firebase Auth account, so the
  // commissioner can populate a full roster (and assign teams) even for
  // people who haven't signed up. If the checkbox is on, we also fire
  // the existing invite email so they know how to log in later.
  async function handleManualAdd(e: FormEvent) {
    e.preventDefault();
    const first = manualFirstName.trim();
    const last = manualLastName.trim();
    const email = manualEmail.trim().toLowerCase();

    if (!first) {
      setManualStatus({ kind: 'error', message: 'First name is required.' });
      return;
    }
    if (!isValidEmail(email)) {
      setManualStatus({ kind: 'error', message: 'Enter a valid email.' });
      return;
    }

    setManualStatus({ kind: 'saving' });
    try {
      const member = await createManualMember({
        leagueCode,
        league,
        firstName: first,
        lastName: last,
        email,
      });

      if (manualAlsoEmail) {
        const tokenUrl = `${window.location.origin}/join/${leagueCode}?invite=${member.inviteToken}`;
        try {
          await sendInviteEmail({
            to: email,
            subject: buildInviteEmailSubject(commissionerName, league.name),
            html: buildInviteEmailHtml({
              leagueName: league.name,
              commissionerName,
              inviteUrl: tokenUrl,
              leagueCode,
            }),
            replyTo: league.commissionerEmail,
          });
          await updateDoc(
            doc(db, 'leagues', leagueCode, 'members', member.id),
            { lastInviteSentAt: serverTimestamp() }
          );
        } catch (err) {
          // The player is already added — surface as a soft warning
          // instead of throwing away the successful add. Include the
          // underlying reason so a repeat failure is diagnosable
          // without hunting through server logs.
          const detail = (err as { message?: string })?.message ?? '';
          console.warn('Manual-add invite email failed:', err);
          setManualStatus({
            kind: 'error',
            message: detail
              ? `${member.name} added, but the invite email didn't send: ${detail}`
              : `${member.name} added, but the invite email didn't send.`,
          });
          setManualFirstName('');
          setManualLastName('');
          setManualEmail('');
          return;
        }
      }

      setManualStatus({ kind: 'ok' });
      setManualFirstName('');
      setManualLastName('');
      setManualEmail('');
      showToast(`✓ ${member.name} added.`);
    } catch (err) {
      const message =
        err instanceof MemberExistsError
          ? 'Someone with that email is already in this league.'
          : (err as { message?: string })?.message ?? 'Add failed.';
      setManualStatus({ kind: 'error', message });
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2500);
    }
  }

  // Native share sheet on mobile (iOS/Android Web Share API), silent
  // clipboard fallback on desktop where navigator.share is undefined.
  async function handleShareInvite() {
    const shareData = {
      title: `Join ${league.name} on 19 Pool`,
      text: `${commissionerName} invited you to their NFL pool. Score exactly 19, win the week's pot.`,
      url: inviteUrl,
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User dismissed the share sheet — not an error worth surfacing.
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Share failed:', err);
        }
      }
      return;
    }

    // Desktop fallback: copy to clipboard, feedback on the share button
    // (kept separate from copyState so each button shows its own state).
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('error');
      window.setTimeout(() => setShareState('idle'), 2500);
    }
  }

  // ── Per-member resend ──────────────────────────────────────────────────────

  function setMemberResendState(memberId: string, state: MemberResendState) {
    setResendStates((prev) => ({ ...prev, [memberId]: state }));
  }

  async function handleResendOne(member: MemberWithId) {
    // Pre-check cooldown from current member data so we can show the state
    // immediately without waiting for resendInvite to return.
    const expiresAt = resendCooldownExpiresAt(member);
    if (expiresAt) {
      setMemberResendState(member.id, { kind: 'cooldown', retryAt: expiresAt });
      return;
    }

    setMemberResendState(member.id, { kind: 'sending' });

    const result = await resendInvite(member, league, leagueCode, league.commissionerEmail);

    if (result.ok) {
      setMemberResendState(member.id, { kind: 'sent' });
      window.setTimeout(
        () => setMemberResendState(member.id, { kind: 'idle' }),
        2000
      );
    } else if (result.reason === 'cooldown' && result.retryAt) {
      setMemberResendState(member.id, { kind: 'cooldown', retryAt: result.retryAt });
    } else {
      // Error — reset to idle (error surfaced via console; no modal needed for one-click)
      setMemberResendState(member.id, { kind: 'idle' });
    }
  }

  // ── Resend All Pending ─────────────────────────────────────────────────────

  async function executeResendAll() {
    setShowResendAllModal(false);
    const targets = pendingMembers.filter((m) => !isInResendCooldown(m));
    if (targets.length === 0) return;

    setResendAllStatus({ kind: 'sending', current: 0, total: targets.length });

    let sent = 0;
    let skipped = 0; // cooldown — shouldn't happen here, but guard it
    const errors: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      const m = targets[i];
      setResendAllStatus({ kind: 'sending', current: i + 1, total: targets.length });
      // Mark as sending in per-member state too
      setMemberResendState(m.id, { kind: 'sending' });

      const result = await resendInvite(m, league, leagueCode, league.commissionerEmail);

      if (result.ok) {
        sent++;
        setMemberResendState(m.id, { kind: 'sent' });
        window.setTimeout(() => setMemberResendState(m.id, { kind: 'idle' }), 2000);
      } else if (result.reason === 'cooldown') {
        skipped++;
        setMemberResendState(m.id, {
          kind: 'cooldown',
          retryAt: result.retryAt ?? new Date(Date.now() + 60 * 60 * 1000),
        });
      } else {
        errors.push(`${m.email}: ${result.error ?? 'Send failed'}`);
        setMemberResendState(m.id, { kind: 'idle' });
      }
    }

    // Also count members already in cooldown that weren't targeted
    const alreadyCooling = pendingMembers.length - targets.length;

    setResendAllStatus({
      kind: 'done',
      sent,
      skipped: skipped + alreadyCooling,
      failed: errors.length,
      errors,
    });
  }

  function handleResendAllClick() {
    const targets = pendingMembers.filter((m) => !isInResendCooldown(m));
    if (targets.length > 10) {
      setShowResendAllModal(true);
    } else {
      void executeResendAll();
    }
  }

  // ── Removal ────────────────────────────────────────────────────────────────

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setRemoveStatus({ kind: 'removing' });

    const target = removeTarget;
    const result = await removeMember(target, league, leagueCode);

    if (!result.ok) {
      const message =
        result.reason === 'commissioner'
          ? "The commissioner can't be removed."
          : result.reason === 'locked'
            ? "Players can't be removed once the season has started."
            : result.error ?? 'Remove failed.';
      setRemoveStatus({ kind: 'error', message });
      return;
    }

    // Success — close modal, surface a toast.
    setRemoveTarget(null);
    setRemoveStatus({ kind: 'idle' });

    const label = target.name?.trim() || target.email;
    const hadTeams = target.teams.length > 0;
    const inAssigned = league.status === 'assigned';

    if (result.wasJoined) {
      const base = `✓ Removed ${label}`;
      const addendum =
        inAssigned && hadTeams
          ? '. Open Teams tab to redistribute their teams.'
          : ' from the league.';
      showToast(base + addendum);
    } else {
      showToast(`✓ Cancelled invite to ${target.email}.`);
    }
  }

  function handleOpenRemoveModal(member: MemberWithId) {
    setRemoveStatus({ kind: 'idle' });
    setRemoveTarget(member);
  }

  function handleCloseRemoveModal() {
    if (removeStatus.kind === 'removing') return;
    setRemoveTarget(null);
    setRemoveStatus({ kind: 'idle' });
  }

  function handleOpenEditModal(member: MemberWithId) {
    setEditStatus({ kind: 'idle' });
    setEditFirstName(member.firstName ?? '');
    setEditLastName(member.lastName ?? '');
    setEditEmail(member.email ?? '');
    setEditTarget(member);
  }

  function handleCloseEditModal() {
    if (editStatus.kind === 'saving') return;
    setEditTarget(null);
    setEditStatus({ kind: 'idle' });
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    const first = editFirstName.trim();
    const last = editLastName.trim();
    const email = editEmail.trim().toLowerCase();

    if (!first && !last) {
      setEditStatus({ kind: 'error', message: 'Enter a first or last name.' });
      return;
    }
    if (!email || !isValidEmail(email)) {
      setEditStatus({ kind: 'error', message: 'Enter a valid email address.' });
      return;
    }

    // Duplicate-email guard. Only runs if the email actually changed — this
    // is a one-shot query against the league's members subcollection and
    // uses the same helper that gates createPendingInvite.
    if (email !== (editTarget.email ?? '').toLowerCase()) {
      try {
        const existing = await findMemberByEmail(leagueCode, email);
        if (existing && existing.id !== editTarget.id) {
          setEditStatus({
            kind: 'error',
            message: 'Another member in this league already uses that email.',
          });
          return;
        }
      } catch (err) {
        setEditStatus({
          kind: 'error',
          message: (err as { message?: string })?.message ?? 'Duplicate check failed.',
        });
        return;
      }
    }

    const newName = buildDisplayName(first, last, email.split('@')[0]);
    setEditStatus({ kind: 'saving' });
    try {
      await updateDoc(doc(db, 'leagues', leagueCode, 'members', editTarget.id), {
        firstName: first,
        lastName: last,
        name: newName,
        email,
      });
      // If we somehow edited the commissioner's own row (UI hides the button,
      // but rule-out for safety), keep the denormalized commissionerName in
      // sync so headers and standings don't drift.
      if (editTarget.role === 'commissioner') {
        await updateDoc(doc(db, 'leagues', leagueCode), {
          commissionerName: newName,
        });
      }
      setEditTarget(null);
      setEditStatus({ kind: 'idle' });
      showToast(`✓ Updated ${newName}`);
    } catch (err) {
      setEditStatus({
        kind: 'error',
        message: (err as { message?: string })?.message ?? 'Save failed.',
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLocked = league.status === 'in_season';
  const isComplete = league.status === 'complete';
  // Commissioner can remove members at any status. Historical weeklyResults
  // aren't touched; the warning banner explains what "removing during the
  // season" actually means.
  const canRemove = true;
  const resendAllSending = resendAllStatus.kind === 'sending';

  const removeIsPending = removeTarget && !removeTarget.joinedAt;
  const removeDisplay = removeTarget?.name?.trim() || removeTarget?.email || '';

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-navy-900 border border-amber-500/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Removal confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseRemoveModal}
          />
          <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-3">
              {removeIsPending
                ? `Cancel pending invite to ${removeTarget.email}?`
                : `Remove ${removeDisplay} from the league?`}
            </h2>
            <div className="mb-6 space-y-1.5">
              <p className="text-slate-400 text-sm">
                {removeIsPending
                  ? "They won't be able to use the invite link anymore. You can re-invite them later if you change your mind."
                  : "They'll lose access to this league and can join a different one. This can't be undone."}
              </p>
              {!removeIsPending && (isLocked || isComplete) && (
                <p className="text-slate-500 text-xs italic">
                  {isLocked
                    ? `This will move ${removeDisplay || 'their'} teams to the unowned pool.`
                    : 'This will not change any historical weekly results.'}
                </p>
              )}
            </div>
            {removeStatus.kind === 'error' && (
              <p className="text-red-400 text-sm mb-4">{removeStatus.message}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCloseRemoveModal}
                disabled={removeStatus.kind === 'removing'}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemove()}
                disabled={removeStatus.kind === 'removing'}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {removeStatus.kind === 'removing'
                  ? 'Removing…'
                  : removeIsPending
                    ? 'Cancel Invite'
                    : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit-member modal */}
      {editTarget && (
        <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseEditModal}
          />
          <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-1">
              Edit {editTarget.name?.trim() || editTarget.email}
            </h2>
            <p className="text-slate-400 text-sm mb-5">
              Fix a typo in this member's name or email address.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    disabled={editStatus.kind === 'saving'}
                    autoFocus
                    className="w-full bg-navy-950/80 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/40 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    disabled={editStatus.kind === 'saving'}
                    className="w-full bg-navy-950/80 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/40 disabled:opacity-60"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={editStatus.kind === 'saving'}
                  className="w-full bg-navy-950/80 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/40 disabled:opacity-60"
                />
                {editTarget.joinedAt ? (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    This is what's shown in the players list and standings. It
                    doesn't change how the player signs in — that's set in
                    their own account.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Their existing invite link stays valid — the token is
                    tied to the invite, not the email.
                  </p>
                )}
              </div>
            </div>

            {editStatus.kind === 'error' && (
              <p className="text-red-400 text-sm mt-4">{editStatus.message}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={editStatus.kind === 'saving'}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={editStatus.kind === 'saving'}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {editStatus.kind === 'saving' ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for >10 Resend All */}
      {showResendAllModal && (
        <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowResendAllModal(false)}
          />
          <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-3">Resend all pending?</h2>
            <p className="text-slate-400 text-sm mb-6">
              Resend invites to{' '}
              <span className="text-white font-semibold">{sendablePendingCount}</span>{' '}
              pending players who aren't in cooldown?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResendAllModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeResendAll()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold transition-all"
              >
                Resend {sendablePendingCount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capacity bar */}
      <div>
        <div className="flex items-end justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Players</h2>
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">{memberCount}</span> of{' '}
            {LEAGUE_CAPACITY} players
          </p>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${capacityPct}%` }}
          />
        </div>
      </div>

      {/* Prominent share CTA. This is the highest-frequency action a
          commissioner takes here, so it lives directly under the
          capacity graphic. Only rendered where the Web Share API
          actually exists (mobile) — desktop users get the Copy Invite
          Link button in the tab below instead. */}
      {canNativeShare && !isLocked && !isComplete && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">
            Send friends a link to join your league.
          </p>
          <button
            type="button"
            onClick={handleShareInvite}
            className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-4 rounded-xl transition-all tracking-wide text-base flex items-center justify-center gap-2"
          >
            {shareState === 'copied' ? (
              <>✓ Link copied to clipboard</>
            ) : shareState === 'error' ? (
              <>Share failed. Try again.</>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.732 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.475l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                </svg>
                Share Invite
              </>
            )}
          </button>
        </div>
      )}

      {/* Post-lock warning banner. Uses hot (vermillion) so it reads as
          a caution independent of the brand-lime accent. */}
      {(isLocked || isComplete) && (
        <div className="bg-hot-dim border border-hot/40 rounded-xl px-4 py-3.5">
          <p className="text-hot font-semibold text-sm mb-1">
            ⚠️{' '}
            {isLocked
              ? 'Season is in progress'
              : 'Season is over'}
          </p>
          <p className="text-ink-dim text-sm leading-relaxed">
            {isLocked
              ? "Removing a member during the season sends their teams back to the unowned pool. Future weeks where those teams score 19 will roll over. Past results don't change."
              : "Removing a member here is for correcting records — it doesn't change any historical results."}
          </p>
        </div>
      )}

      {/* Invite panels (hidden after lock) */}
      {isLocked ? (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-5 flex items-start gap-3">
          <span className="text-lg mt-0.5">🔒</span>
          <div>
            <p className="text-white font-semibold text-sm">League is locked</p>
            <p className="text-slate-400 text-sm mt-0.5">
              No new players can be added once the season begins.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-5">
          <div className="flex border-b border-white/10 mb-4">
            <InvitePanelTab
              active={activeTab === 'link'}
              onClick={() => setActiveTab('link')}
            >
              Link
            </InvitePanelTab>
            <InvitePanelTab
              active={activeTab === 'email'}
              onClick={() => setActiveTab('email')}
            >
              Email
            </InvitePanelTab>
            <InvitePanelTab
              active={activeTab === 'manual'}
              onClick={() => setActiveTab('manual')}
            >
              Manual
            </InvitePanelTab>
          </div>

          {activeTab === 'email' ? (
            <form onSubmit={handleSendInvites} className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Invite emails
                </span>
                <textarea
                  value={emailsRaw}
                  onChange={(e) => setEmailsRaw(e.target.value)}
                  placeholder="Paste emails (one per line, or separated by commas)"
                  rows={4}
                  className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-3 rounded-xl text-sm font-mono"
                />
              </label>
              <button
                type="submit"
                disabled={sendStatus.kind === 'sending'}
                className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendStatus.kind === 'sending'
                  ? `Sending ${sendStatus.current} of ${sendStatus.total}…`
                  : 'Send Invites'}
              </button>

              {sendStatus.kind === 'done' && (
                <div className="text-sm space-y-1">
                  {sendStatus.sent > 0 && (
                    <p className="text-green-400">
                      ✓ Sent {sendStatus.sent} invite{sendStatus.sent === 1 ? '' : 's'}.
                    </p>
                  )}
                  {sendStatus.skipped.length > 0 && (
                    <p className="text-slate-400">
                      Skipped {sendStatus.skipped.length} already-invited address
                      {sendStatus.skipped.length === 1 ? '' : 'es'}.
                    </p>
                  )}
                  {sendStatus.failed.length > 0 && (
                    <ul className="text-red-400 list-disc list-inside">
                      {sendStatus.failed.map((f, i) => (
                        <li key={i}>
                          {f.email ? `${f.email}: ` : ''}
                          {f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          ) : activeTab === 'manual' ? (
            <form onSubmit={handleManualAdd} className="space-y-3">
              <p className="text-sm text-slate-400">
                Add a player straight to your league. They join
                immediately so you can assign teams. If they sign up
                later with the same email, everything stays connected.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    First Name
                  </span>
                  <input
                    type="text"
                    value={manualFirstName}
                    onChange={(e) => setManualFirstName(e.target.value)}
                    placeholder="Tom"
                    autoComplete="off"
                    className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-3 py-2.5 rounded-xl text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                    Last Name
                  </span>
                  <input
                    type="text"
                    value={manualLastName}
                    onChange={(e) => setManualLastName(e.target.value)}
                    placeholder="Mulkeen"
                    autoComplete="off"
                    className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-3 py-2.5 rounded-xl text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Email
                </span>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="tom@example.com"
                  autoComplete="off"
                  className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-3 py-2.5 rounded-xl text-sm"
                />
              </label>
              <label className="flex items-start gap-2.5 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualAlsoEmail}
                  onChange={(e) => setManualAlsoEmail(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-500"
                />
                <span>
                  Also email them the sign-up link
                  <span className="text-slate-500 block text-xs mt-0.5">
                    Off by default. Flip on if you want them to be able
                    to log in and see their own standings.
                  </span>
                </span>
              </label>

              {manualStatus.kind === 'error' && (
                <p className="text-sm text-red-400">{manualStatus.message}</p>
              )}

              <button
                type="submit"
                disabled={manualStatus.kind === 'saving'}
                className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {manualStatus.kind === 'saving' ? 'Adding…' : 'Add Player'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Anyone with this link can join your league. Capacity is enforced
                automatically.
              </p>
              <div className="bg-navy-950/80 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-amber-400 break-all">
                {inviteUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl transition-all tracking-wide"
              >
                {copyState === 'copied'
                  ? '✓ Copied!'
                  : copyState === 'error'
                    ? 'Copy failed. Select and copy manually.'
                    : 'Copy Invite Link'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Roster */}
      <div>
        {/* Resend All header row */}
        {!isLocked && pendingMembers.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Roster
            </h3>
            <button
              type="button"
              onClick={handleResendAllClick}
              disabled={resendAllSending || sendablePendingCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resendAllSending ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Sending {resendAllStatus.kind === 'sending' ? `${resendAllStatus.current} of ${resendAllStatus.total}` : ''}…
                </>
              ) : (
                <>↻ Resend All Pending ({sendablePendingCount})</>
              )}
            </button>
          </div>
        )}

        {/* Resend All result */}
        {resendAllStatus.kind === 'done' && (
          <div className="mb-3 text-xs text-slate-400 bg-navy-950/60 border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap gap-x-3 gap-y-1 items-center">
            {resendAllStatus.sent > 0 && (
              <span className="text-green-400">✓ Sent {resendAllStatus.sent}</span>
            )}
            {resendAllStatus.skipped > 0 && (
              <span>Skipped {resendAllStatus.skipped} (cooldown)</span>
            )}
            {resendAllStatus.failed > 0 && (
              <span className="text-red-400">
                {resendAllStatus.failed} failed
                {resendAllStatus.errors.length > 0 &&
                  ` — ${resendAllStatus.errors[0]}${resendAllStatus.errors.length > 1 ? ` +${resendAllStatus.errors.length - 1} more` : ''}`}
              </span>
            )}
            <button
              type="button"
              className="ml-auto text-slate-600 hover:text-slate-400 transition-colors"
              onClick={() => setResendAllStatus({ kind: 'idle' })}
            >
              ✕
            </button>
          </div>
        )}

        {!pendingMembers.length && (
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Roster
          </h3>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">Loading players…</p>
        ) : members.length === 0 ? (
          <p className="text-slate-500 text-sm">No players yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                resendState={resendStates[m.id] ?? { kind: 'idle' }}
                onResend={() => void handleResendOne(m)}
                onRemove={() => handleOpenRemoveModal(m)}
                onEdit={() => handleOpenEditModal(m)}
                showResend={!isLocked}
                showRemove={canRemove}
                showEdit={true}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  resendState,
  onResend,
  onRemove,
  onEdit,
  showResend,
  showRemove,
  showEdit,
}: {
  member: MemberWithId;
  resendState: MemberResendState;
  onResend: () => void;
  onRemove: () => void;
  onEdit: () => void;
  showResend: boolean;
  showRemove: boolean;
  showEdit: boolean;
}) {
  const initials = getInitials(member);
  const display = member.name?.trim() || member.email;
  const badge = roleBadge(member);
  const isPending = !member.joinedAt && member.role !== 'commissioner';
  const isCommissioner = member.role === 'commissioner';

  // Cooldown tooltip label
  const cooldownLabel =
    resendState.kind === 'cooldown'
      ? `Resent recently — try again at ${resendState.retryAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : undefined;

  return (
    <li className="flex items-center gap-3 bg-navy-950/60 border border-white/10 rounded-xl px-4 py-3">
      <div className="w-10 h-10 rounded-full bg-paper-3 border border-ink-line text-ink font-bold text-sm flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{display}</p>
        <p className="text-xs text-slate-400 truncate">{member.email}</p>
      </div>

      {/* Badge + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>

        {showResend && isPending && (
          <ResendButton
            state={resendState}
            onClick={onResend}
            cooldownLabel={cooldownLabel}
          />
        )}

        {showEdit && !isCommissioner && (
          <button
            type="button"
            onClick={onEdit}
            title="Edit name or email"
            aria-label="Edit name or email"
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors text-sm leading-none"
          >
            ✎
          </button>
        )}

        {showRemove && !isCommissioner && (
          <button
            type="button"
            onClick={onRemove}
            title={isPending ? 'Cancel invite' : 'Remove member'}
            aria-label={isPending ? 'Cancel invite' : 'Remove member'}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
}

// ─── ResendButton ─────────────────────────────────────────────────────────────

function ResendButton({
  state,
  onClick,
  cooldownLabel,
}: {
  state: MemberResendState;
  onClick: () => void;
  cooldownLabel?: string;
}) {
  if (state.kind === 'sent') {
    return (
      <span className="text-xs text-green-400 font-medium w-14 text-center">✓ Sent</span>
    );
  }

  if (state.kind === 'sending') {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400 w-14 justify-center">
        <span className="inline-block w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
      </span>
    );
  }

  if (state.kind === 'cooldown') {
    return (
      <span
        title={cooldownLabel}
        className="text-xs text-slate-600 cursor-default w-14 text-center select-none"
      >
        ↻ Resend
      </span>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-slate-400 hover:text-amber-400 transition-colors w-14 text-center font-medium"
    >
      ↻ Resend
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(member: MemberWithId): string {
  const first = (member.firstName || member.name || member.email || '').trim();
  const last = (member.lastName || '').trim();
  const a = first.charAt(0).toUpperCase();
  const b = last.charAt(0).toUpperCase();
  return (a + b).slice(0, 2) || '?';
}

function roleBadge(member: MemberWithId): { label: string; className: string } {
  if (member.role === 'commissioner') {
    return {
      label: 'Commissioner',
      className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    };
  }
  if (!member.joinedAt) {
    return {
      label: 'Pending',
      className: 'bg-white/5 text-slate-400 border border-white/10',
    };
  }
  return {
    label: 'Joined',
    className: 'bg-green-500/10 text-green-400 border border-green-500/30',
  };
}

function parseEmails(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => {
      if (!s) return false;
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

// Underlined tab used in the invite panel's tab row. Matches the
// dashboard nav aesthetic — hairline row separator, volt-lime bar
// under the active tab. Equal-width so three short labels sit on
// one line even on narrow mobile viewports.
function InvitePanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 pb-2.5 -mb-px text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
        active
          ? 'text-white border-accent'
          : 'text-slate-400 border-transparent hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
