import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
  LEAGUE_CAPACITY,
  createPendingInvite,
  isValidEmail,
  membersCollectionRef,
  sendInviteEmail,
  sortMembers,
} from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import {
  buildInviteEmailHtml,
  buildInviteEmailSubject,
} from '../../lib/inviteEmail';
import type { League } from '../../lib/types';

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

export default function MembersTab({ leagueCode, league, commissionerName }: Props) {
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InviteTab>('email');
  const [emailsRaw, setEmailsRaw] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>({ kind: 'idle' });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

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
      () => {
        setLoading(false);
      }
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
        sent++;
      } catch (err) {
        failed.push({
          email,
          error: (err as { message?: string })?.message ?? 'Send failed',
        });
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

  const isLocked = league.status === 'in_season';

  return (
    <div className="space-y-6">
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

      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Roster
        </h3>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="text-slate-500 text-sm">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: MemberWithId }) {
  const initials = getInitials(member);
  const display = member.name?.trim() || member.email;
  const badge = roleBadge(member);

  return (
    <li className="flex items-center gap-3 bg-navy-950/60 border border-white/10 rounded-xl px-4 py-3">
      <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{display}</p>
        <p className="text-xs text-slate-400 truncate">{member.email}</p>
      </div>
      <span
        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.className}`}
      >
        {badge.label}
      </span>
    </li>
  );
}

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
