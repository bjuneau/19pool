import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getCurrentNFLWeek } from '../../lib/espn';
import { membersCollectionRef, sortMembers } from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import {
  computeWeeklyShareFromPot,
  getSeasonPot,
} from '../../lib/scoring';
import type { League, WeeklyResult } from '../../lib/types';

type Props = {
  league: League;
  leagueCode: string;
};

type MemberStats = {
  member: MemberWithId;
  wins: number;
  totalWon: number;
};

function fmtDollars(n: number): string {
  return (
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  );
}

function computeStandings(
  members: MemberWithId[],
  weeklyResults: WeeklyResult[]
): MemberStats[] {
  return members
    .filter((m) => m.joinedAt != null)
    .map((m) => {
      let wins = 0;
      let totalWon = 0;
      for (const wr of weeklyResults) {
        if (wr.winningMemberIds.includes(m.id)) {
          wins++;
          totalWon += wr.payoutPerWinner;
        }
      }
      return { member: m, wins, totalWon };
    })
    .sort(
      (a, b) =>
        b.totalWon - a.totalWon ||
        b.wins - a.wins ||
        a.member.name.localeCompare(b.member.name)
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StandingsTab({ league, leagueCode }: Props) {
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [weeklyResults, setWeeklyResults] = useState<WeeklyResult[]>([]);
  const [pastWeeksExpanded, setPastWeeksExpanded] = useState(true);

  // Subscribe to members.
  useEffect(() => {
    const unsub = onSnapshot(membersCollectionRef(leagueCode), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MemberWithId, 'id'>),
      }));
      setMembers(sortMembers(list));
    });
    return unsub;
  }, [leagueCode]);

  // Subscribe to weekly results.
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'leagues', leagueCode, 'weeklyResults'),
        orderBy('week', 'asc')
      ),
      (snap) => {
        setWeeklyResults(snap.docs.map((d) => d.data() as WeeklyResult));
      }
    );
    return unsub;
  }, [leagueCode]);

  // Clip to weeks that have actually happened. "Refresh All Weeks" is a
  // simple 1..18 loop, so on a fully-played historical season the collection
  // holds every week — but the standings should only reflect what's happened
  // through today (or, in test mode, through the pinned test week).
  // For 'complete' leagues, currentNFLWeek is null → keep everything.
  const currentWeek = getCurrentNFLWeek(league.season);
  const upToNow = weeklyResults.filter(
    (r) => currentWeek === null || r.week <= currentWeek
  );

  const standings = computeStandings(members, upToNow);
  const completedResults = [...upToNow]
    .filter((r) => r.status === 'final' || r.status === 'rolled_over')
    .sort((a, b) => b.week - a.week);
  const totalHits19 = upToNow.reduce(
    (n, wr) => n + (wr.teamsAt19?.length ?? 0),
    0
  );

  // Money stats — read-only; editing lives on Account.
  const pot = getSeasonPot(league);
  const weeklyPot = computeWeeklyShareFromPot(pot);

  if (league.status !== 'in_season' && league.status !== 'complete') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-white">Standings</h1>
        <p className="text-slate-400 text-sm">Full season leaderboard.</p>
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-2xl mb-2">🏈</p>
          <p className="text-white font-semibold mb-1">Standings will appear once the season starts</p>
          <p className="text-slate-400 text-sm">
            {league.status === 'recruiting'
              ? 'Come back after the commissioner assigns teams and locks the league.'
              : 'Come back after the commissioner locks the league to begin the season.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Standings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Full season leaderboard</p>
      </div>

      {/* Stat cards — three in a row (This Week's Pot lives on the
          Weekly Results tab, no need to repeat it here). */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Pot" value={fmtDollars(pot)} accent />
        <StatCard label="Weekly Pot" value={fmtDollars(weeklyPot)} accent />
        <StatCard label="Total 19s" value={String(totalHits19)} accent={totalHits19 > 0} />
      </div>

      {/* Leaderboard */}
      <div className="bg-navy-950/60 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-white font-bold">{league.season} Season</p>
          {standings.length === 0 && (
            <p className="text-xs text-slate-500 mt-0.5">No joined players yet.</p>
          )}
        </div>
        {standings.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-5 py-2 border-b border-white/5 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              <span className="w-5 text-right">#</span>
              <span className="w-7" />
              <span className="flex-1">Player</span>
              <span className="text-right">19s</span>
            </div>
            <div className="divide-y divide-white/5">
              {standings.map((s, i) => (
                <StandingsRow key={s.member.id} rank={i + 1} stats={s} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Past weeks */}
      {completedResults.length > 0 && (
        <PastWeeksSection
          results={completedResults}
          members={members}
          expanded={pastWeeksExpanded}
          onToggle={() => setPastWeeksExpanded((v) => !v)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-2xl font-extrabold mt-1 ${
          accent ? 'text-amber-400' : 'text-slate-500'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StandingsRow({ rank, stats }: { rank: number; stats: MemberStats }) {
  const { member, wins, totalWon } = stats;
  const initials = (
    (member.firstName || '').charAt(0) + (member.lastName || '').charAt(0)
  )
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span
        className={`text-xs w-5 text-right flex-shrink-0 font-bold ${
          rank === 1 ? 'text-amber-400' : 'text-slate-600'
        }`}
      >
        {rank}
      </span>
      <div className="w-7 h-7 rounded-full bg-paper-3 border border-ink-line text-ink text-xs font-bold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">
          {member.name || member.email}
        </p>
        {totalWon > 0 && (
          <p className="text-[10px] text-slate-500 mt-0.5">
            {fmtDollars(totalWon)} won
          </p>
        )}
      </div>
      <p
        className={`text-lg font-extrabold text-right flex-shrink-0 w-10 ${
          wins > 0 ? 'text-green-400' : 'text-slate-600'
        }`}
      >
        {wins}
      </p>
    </div>
  );
}

function PastWeeksSection({
  results,
  members,
  expanded,
  onToggle,
}: {
  results: WeeklyResult[];
  members: MemberWithId[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-navy-950/60 border border-white/10 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/2 transition-colors"
      >
        <p className="text-white font-semibold">
          Past Weeks
          <span className="ml-2 text-xs text-slate-500 font-normal">
            ({results.length} completed)
          </span>
        </p>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-white/5 border-t border-white/5">
          {results.map((wr) => (
            <PastWeekRow key={wr.week} result={wr} members={members} />
          ))}
        </div>
      )}
    </div>
  );
}

function PastWeekRow({
  result,
  members,
}: {
  result: WeeklyResult;
  members: MemberWithId[];
}) {
  const winnerNames = result.winningMemberIds.map((id) => {
    const m = members.find((x) => x.id === id);
    return m?.name ?? m?.email ?? 'Unknown';
  });

  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4">
      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-sm w-14 flex-shrink-0">
          Week {result.week}
        </span>
        <StatusPill status={result.status} />
      </div>
      <div className="text-right flex-1 min-w-0">
        {result.status === 'rolled_over' ? (
          <p className="text-slate-500 text-xs">No winner — pot rolled over</p>
        ) : winnerNames.length > 0 ? (
          <p className="text-xs text-green-400 truncate">
            🏆 {winnerNames.join(', ')}
            <span className="text-slate-500 ml-1">
              · {fmtDollars(result.payoutPerWinner)} each
            </span>
          </p>
        ) : (
          <p className="text-slate-500 text-xs">—</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: WeeklyResult['status'] }) {
  const configs: Record<WeeklyResult['status'], { label: string; cls: string }> = {
    in_progress: {
      label: 'Live',
      cls: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    final: {
      label: 'Final',
      cls: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    rolled_over: {
      label: 'Rolled over',
      cls: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
    },
  };
  const cfg = configs[status];
  return (
    <span
      className={`inline-block rounded-full border font-semibold text-[10px] px-2 py-0.5 ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
