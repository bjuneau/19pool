import { useEffect, useRef, useState } from 'react';
import {
  Timestamp,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { membersCollectionRef, sortMembers } from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import type { League, Member } from '../../lib/types';

type Props = {
  leagueCode: string;
  league: League;
};

type FilterKind = 'all' | 'paid' | 'unpaid';

function isPaid(member: MemberWithId): boolean {
  return member.paid === true;
}

function fmtDollars(n: number): string {
  return (
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  );
}

function fmtDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initialsOf(m: MemberWithId): string {
  const first = (m.firstName?.[0] ?? '').toUpperCase();
  const last = (m.lastName?.[0] ?? '').toUpperCase();
  if (first || last) return (first + last) || first || last;
  return (m.name?.[0] ?? m.email?.[0] ?? '?').toUpperCase();
}

function buildVenmoRequestUrl(
  venmoHandle: string,
  amount: number,
  note: string
): string {
  const cleaned = venmoHandle.replace(/^@/, '');
  const encoded = encodeURIComponent(note);
  return `https://venmo.com/${cleaned}?txn=charge&amount=${amount}&note=${encoded}`;
}

export default function PaymentsTab({ leagueCode, league }: Props) {
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    const unsub = onSnapshot(membersCollectionRef(leagueCode), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Member),
      }));
      setMembers(sortMembers(list));
    });
    return unsub;
  }, [leagueCode]);

  // Only joined members owe money. Pending invites haven't committed yet.
  const joined = members.filter((m) => m.joinedAt != null);
  const entry = league.seasonEntry;
  const memberCount = joined.length;
  const paidCount = joined.filter(isPaid).length;
  const totalOwed = entry * memberCount;
  const totalCollected = entry * paidCount;
  const hasEntry = entry > 0;

  const filtered = joined.filter((m) => {
    if (filter === 'paid') return isPaid(m);
    if (filter === 'unpaid') return !isPaid(m);
    return true;
  });

  async function markPaid(member: MemberWithId) {
    setSaving((s) => new Set(s).add(member.id));
    try {
      // Firestore's client cache updates optimistically — the onSnapshot
      // listener fires immediately with the new local state, so the UI
      // flips without a manual set. If the server write fails, the cache
      // reverts and the listener re-fires with the old state.
      await updateDoc(doc(db, 'leagues', leagueCode, 'members', member.id), {
        paid: true,
        paidAt: serverTimestamp(),
      });
      showToast(`✓ Marked ${member.name} as paid`);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Update failed';
      showToast(`Failed: ${msg}`);
    } finally {
      setSaving((s) => {
        const n = new Set(s);
        n.delete(member.id);
        return n;
      });
    }
  }

  // Bulk-marks every joined player who isn't already paid. Already-paid
  // rows are skipped — we don't rewrite their paidAt timestamp. The
  // optimistic-cache pattern from markPaid extends: onSnapshot fires with
  // the new local state before the server round-trips.
  async function markAllPaid() {
    const targets = joined.filter((m) => !isPaid(m));
    if (targets.length === 0) return;

    setSaving((s) => {
      const n = new Set(s);
      targets.forEach((m) => n.add(m.id));
      return n;
    });
    try {
      await Promise.all(
        targets.map((m) =>
          updateDoc(doc(db, 'leagues', leagueCode, 'members', m.id), {
            paid: true,
            paidAt: serverTimestamp(),
          })
        )
      );
      showToast(
        `✓ Marked ${targets.length} player${targets.length === 1 ? '' : 's'} as paid`
      );
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Update failed';
      showToast(`Some updates failed: ${msg}`);
    } finally {
      setSaving((s) => {
        const n = new Set(s);
        targets.forEach((m) => n.delete(m.id));
        return n;
      });
    }
  }

  async function markUnpaid(member: MemberWithId) {
    setSaving((s) => new Set(s).add(member.id));
    try {
      await updateDoc(doc(db, 'leagues', leagueCode, 'members', member.id), {
        paid: false,
        paidAt: null,
      });
      showToast(`Marked ${member.name} as unpaid`);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? 'Update failed';
      showToast(`Failed: ${msg}`);
    } finally {
      setSaving((s) => {
        const n = new Set(s);
        n.delete(member.id);
        return n;
      });
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Payments</h1>
          <p className="text-slate-400 text-sm mt-1">
            {hasEntry ? (
              <>
                <span className="text-white font-semibold">
                  {fmtDollars(totalCollected)}
                </span>{' '}
                collected of{' '}
                <span className="text-white font-semibold">
                  {fmtDollars(totalOwed)}
                </span>{' '}
                owed
                <span className="text-slate-600"> · </span>
                <span className="text-white font-semibold">
                  {paidCount} of {memberCount}
                </span>{' '}
                paid
              </>
            ) : (
              <>
                <span className="text-white font-semibold">
                  {paidCount} of {memberCount}
                </span>{' '}
                marked paid
              </>
            )}
          </p>
        </div>

        {/* Bulk + filter controls */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-shrink-0">
          {memberCount - paidCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllPaid()}
              className="text-xs font-semibold text-slate-400 hover:text-accent transition-colors underline-offset-2 hover:underline"
            >
              Mark All Paid
            </button>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="payments-filter" className="text-xs text-slate-500 uppercase tracking-wider">
              Show
            </label>
            <select
              id="payments-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKind)}
              className="bg-navy-950/80 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500/40 cursor-pointer"
            >
              <option value="all">All ({memberCount})</option>
              <option value="paid">Paid ({paidCount})</option>
              <option value="unpaid">Unpaid ({memberCount - paidCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* No-entry-fee hint */}
      {!hasEntry && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm px-4 py-3 rounded-xl">
          No entry fee is set. Configure it in the{' '}
          <a href="/account" className="underline hover:text-amber-200">
            Account
          </a>{' '}
          page's Money section to enable per-player amounts.
        </div>
      )}

      {/* List */}
      {memberCount === 0 ? (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-sm">
            No players to track yet. Invite players from the Players tab.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-sm">
            No {filter} members.{' '}
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
            >
              Clear filter
            </button>
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <PaymentRow
              key={m.id}
              member={m}
              amountOwed={entry}
              hasEntry={hasEntry}
              saving={saving.has(m.id)}
              isSelf={m.uid != null && m.uid === league.commissionerId}
              venmoNote={`${league.name} entry fee`}
              onMarkPaid={() => void markPaid(m)}
              onMarkUnpaid={() => void markUnpaid(m)}
            />
          ))}
        </ul>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-navy-900 border border-amber-500/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── PaymentRow ───────────────────────────────────────────────────────────────

function PaymentRow({
  member,
  amountOwed,
  hasEntry,
  saving,
  isSelf,
  venmoNote,
  onMarkPaid,
  onMarkUnpaid,
}: {
  member: MemberWithId;
  amountOwed: number;
  hasEntry: boolean;
  saving: boolean;
  isSelf: boolean;
  venmoNote: string;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
}) {
  const paid = isPaid(member);
  const initials = initialsOf(member);
  // Use the PLAYER's Venmo — a charge URL targets the recipient, so it needs
  // to point at the person we're requesting money from. Commissioner's own
  // row: no self-request (they're the collector).
  const memberVenmo = (member.venmo ?? '').trim().replace(/^@/, '');
  const hasVenmo = !isSelf && memberVenmo.length > 0;

  return (
    <li className="bg-navy-950/60 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-paper-3 border border-ink-line text-ink font-bold text-sm flex items-center justify-center flex-shrink-0">
          {initials}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">
            {member.name || member.email}
            {member.role === 'commissioner' && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                Commissioner
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 truncate">{member.email}</p>
        </div>

        {/* Amount + status */}
        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          <p className="text-white font-bold text-sm">
            {fmtDollars(amountOwed)}
          </p>
          {paid ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
              Paid
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Unpaid
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      {hasEntry && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
          {paid ? (
            <>
              <p className="text-xs text-slate-500">
                Paid on{' '}
                <span className="text-slate-300">{fmtDate(member.paidAt)}</span>
              </p>
              <button
                type="button"
                onClick={onMarkUnpaid}
                disabled={saving}
                className="text-xs text-slate-400 hover:text-white transition-colors font-semibold disabled:opacity-50"
              >
                Mark Unpaid
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onMarkPaid}
                disabled={saving}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Mark Paid'}
              </button>
              {hasVenmo ? (
                <a
                  href={buildVenmoRequestUrl(memberVenmo, amountOwed, venmoNote)}
                  target="_blank"
                  rel="noopener"
                  className="text-xs text-slate-300 hover:text-amber-400 transition-colors font-semibold"
                >
                  Send Venmo Request to{' '}
                  <span className="text-amber-400">@{memberVenmo}</span> →
                </a>
              ) : isSelf ? null : (
                <a
                  href="https://venmo.com/"
                  target="_blank"
                  rel="noopener"
                  title="No Venmo handle on file — search for them on Venmo."
                  className="text-xs text-slate-400 hover:text-amber-400 transition-colors font-semibold"
                >
                  Find on Venmo →
                </a>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
