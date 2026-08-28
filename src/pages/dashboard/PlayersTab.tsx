import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { membersCollectionRef, sortMembers } from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import { TEAM_BY_ABBR } from '../../lib/teams';
import { LEAGUE_CAPACITY } from '../../lib/types';
import type { League } from '../../lib/types';

// Read-only roster view for every logged-in league member. Commissioners
// have Admin > Members for invite / remove / edit; this tab is the
// non-commissioner equivalent, plus a quick at-a-glance view for
// commissioners themselves.

type Props = {
  leagueCode: string;
  league: League;
};

export default function PlayersTab({ leagueCode, league }: Props) {
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loading, setLoading] = useState(true);

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

  const joinedMembers = useMemo(
    () => members.filter((m) => m.joinedAt != null),
    [members]
  );
  const pendingMembers = useMemo(
    () => members.filter((m) => m.joinedAt == null),
    [members]
  );
  const capacityPct = Math.min(
    100,
    (joinedMembers.length / LEAGUE_CAPACITY) * 100
  );
  const isRecruiting = league.status === 'recruiting';

  return (
    <div className="space-y-6">
      {/* Capacity bar — mirrors the commissioner-facing Members tab so
          both views feel like the same product. */}
      <div>
        <div className="flex items-end justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Players</h2>
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">
              {joinedMembers.length}
            </span>{' '}
            of {LEAGUE_CAPACITY} joined
          </p>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${capacityPct}%` }}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading players…</p>
      ) : joinedMembers.length === 0 && pendingMembers.length === 0 ? (
        <p className="text-slate-500 text-sm">
          No players yet — {league.commissionerName || 'the commissioner'} is
          still setting things up.
        </p>
      ) : (
        <>
          {joinedMembers.length > 0 && (
            <ul className="space-y-2">
              {joinedMembers.map((m) => (
                <PlayerRow key={m.id} member={m} isRecruiting={isRecruiting} />
              ))}
            </ul>
          )}

          {pendingMembers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.14em] mb-3 mt-8">
                Invited, not joined yet
              </h3>
              <ul className="space-y-2">
                {pendingMembers.map((m) => (
                  <PlayerRow key={m.id} member={m} isRecruiting={isRecruiting} pending />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlayerRow({
  member,
  isRecruiting,
  pending = false,
}: {
  member: MemberWithId;
  isRecruiting: boolean;
  pending?: boolean;
}) {
  // Compose from firstName + lastName directly so this always reflects
  // the player's Account page. `member.name` is denormalized and can lag
  // when a rename hasn't propagated. Empty-name fallback is "Player" —
  // never the email prefix, which would leak identity to other members.
  const first = (member.firstName ?? '').trim();
  const last = (member.lastName ?? '').trim();
  const displayName = [first, last].filter(Boolean).join(' ') || 'Player';
  const initials = getInitials(first, last);
  const isCommissioner = member.role === 'commissioner';
  const teams = member.teams ?? [];

  return (
    <li
      className={`flex items-center gap-3 bg-navy-950/60 border border-white/10 rounded-xl px-4 py-3 ${pending ? 'opacity-70' : ''}`}
    >
      <div className="w-10 h-10 rounded-full bg-white/10 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-semibold truncate">{displayName}</p>
          {isCommissioner && (
            <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">
              Commissioner
            </span>
          )}
        </div>
        {pending && (
          <p className="text-xs text-slate-500 italic mt-0.5">
            Invitation pending
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-1.5 flex-shrink-0 max-w-[55%]">
        {teams.length > 0 ? (
          teams.map((abbr) => <TeamPill key={abbr} abbr={abbr} />)
        ) : isRecruiting ? (
          <RecruitingPill />
        ) : null}
      </div>
    </li>
  );
}

function TeamPill({ abbr }: { abbr: string }) {
  const team = TEAM_BY_ABBR[abbr];
  const label = team?.fullName ?? abbr;
  return (
    <span
      title={label}
      className="text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 px-2.5 py-1 rounded-md whitespace-nowrap"
    >
      {label}
    </span>
  );
}

function RecruitingPill() {
  return (
    <span className="text-xs font-semibold italic text-slate-500 px-2.5 py-1 whitespace-nowrap">
      Recruiting
    </span>
  );
}

function getInitials(first: string, last: string): string {
  const a = first.trim()[0];
  const b = last.trim()[0];
  if (a && b) return (a + b).toUpperCase();
  if (a) return a.toUpperCase();
  if (b) return b.toUpperCase();
  return '?';
}
