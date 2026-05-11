import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  LEAGUE_CAPACITY,
  MemberExistsError,
  createPendingInvite,
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

type InviteTab = 'email' | 'link';

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
  const [activeTab, setActiveTab] = useState<InviteTab>('email');
  const [emailsRaw, setEmailsRaw] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>({ kind: 'idle' });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

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
            ? "Members can't be removed once the season has started."
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLocked = league.status === 'in_season';
  const canRemove =
    league.status !== 'in_season' && league.status !== 'complete';
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
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
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
            <p className="text-slate-400 text-sm mb-6">
              {removeIsPending
                ? "They won't be able to use the invite link anymore. You can re-invite them later if you change your mind."
                : "They'll lose access to this league and can join a different one. This can't be undone."}
            </p>
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

      {/* Confirmation modal for >10 Resend All */}
      {showResendAllModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowResendAllModal(false)}
          />
          <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-3">Resend all pending?</h2>
            <p className="text-slate-400 text-sm mb-6">
              Resend invites to{' '}
              <span className="text-white font-semibold">{sendablePendingCount}</span>{' '}
              pending members who aren't in cooldown?
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
          <h2 className="text-xl font-bold text-white">Members</h2>
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">{memberCount}</span> of{' '}
            {LEAGUE_CAPACITY} members
          </p>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${capacityPct}%` }}
          />
        </div>
      </div>

      {/* Invite panels (hidden after lock) */}
      {isLocked ? (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-5 flex items-start gap-3">
          <span className="text-lg mt-0.5">🔒</span>
          <div>
            <p className="text-white font-semibold text-sm">League is locked</p>
            <p className="text-slate-400 text-sm mt-0.5">
              No new members can be added once the season begins.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-5">
          <div className="flex bg-navy-950/80 rounded-xl p-1 mb-4 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'email'
                  ? 'bg-navy-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Send Email Invite
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'link'
                  ? 'bg-navy-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Copy Shareable Link
            </button>
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
                    ? 'Copy failed — select and copy manually'
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
          <p className="text-slate-500 text-sm">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="text-slate-500 text-sm">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                resendState={resendStates[m.id] ?? { kind: 'idle' }}
                onResend={() => void handleResendOne(m)}
                onRemove={() => handleOpenRemoveModal(m)}
                showResend={!isLocked}
                showRemove={canRemove}
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
  showResend,
  showRemove,
}: {
  member: MemberWithId;
  resendState: MemberResendState;
  onResend: () => void;
  onRemove: () => void;
  showResend: boolean;
  showRemove: boolean;
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
      <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
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
