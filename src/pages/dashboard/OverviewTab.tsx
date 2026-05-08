import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getCurrentNFLWeek } from '../../lib/espn';
import { membersCollectionRef, sortMembers } from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import { computePot, computeWeeklyShare } from '../../lib/scoring';
import { refreshWeek } from '../../lib/scoringWriter';
import { TEAM_BY_ABBR } from '../../lib/teams';
import type { GameResult, League, WeeklyResult } from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  firstName: string;
  league: League | null;
  leagueCode: string;
  loadingProfile: boolean;
  userId: string;
  isCommissioner: boolean;
};

type MemberStats = {
  member: MemberWithId;
  wins: number;
  totalWon: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    .sort((a, b) => b.totalWon - a.totalWon || b.wins - a.wins || a.member.name.localeCompare(b.member.name));
}

/** Count how many weeks each team was in teamsAt19 across all results. */
function teamWinCounts(weeklyResults: WeeklyResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const wr of weeklyResults) {
    for (const abbr of wr.teamsAt19) {
      counts[abbr] = (counts[abbr] ?? 0) + 1;
    }
  }
  return counts;
}

function fmtDollars(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtGameTime(isoStr: string): string {
  if (!isoStr) return 'TBD';
  try {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoStr;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OverviewTab({
  firstName,
  league,
  leagueCode,
  loadingProfile,
  userId,
  isCommissioner,
}: Props) {
  const [weeklyResults, setWeeklyResults] = useState<WeeklyResult[]>([]);
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshAllProgress, setRefreshAllProgress] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const [pastWeeksExpanded, setPastWeeksExpanded] = useState(false);

  // Stable ref so poll closure doesn't capture stale members.
  const membersRef = useRef<MemberWithId[]>([]);
  membersRef.current = members;

  const isInSeason = league?.status === 'in_season';
  const currentWeek = league ? getCurrentNFLWeek(league.season) : null;
  const currentResult = weeklyResults.find((r) => r.week === currentWeek) ?? null;
  const completedResults = [...weeklyResults]
    .filter((r) => r.status === 'final' || r.status === 'rolled_over')
    .sort((a, b) => b.week - a.week);
  const myMember = members.find((m) => m.uid === userId) ?? null;

  // Subscribe to members.
  useEffect(() => {
    if (!leagueCode) return;
    const unsub = onSnapshot(
      membersCollectionRef(leagueCode),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MemberWithId, 'id'>),
        }));
        setMembers(sortMembers(list));
      },
      () => {} // ignore errors — stale data is acceptable
    );
    return unsub;
  }, [leagueCode]);

  // Subscribe to weeklyResults (in_season only).
  useEffect(() => {
    if (!leagueCode || !isInSeason) return;
    setLoadingResults(true);
    const q = query(
      collection(db, 'leagues', leagueCode, 'weeklyResults'),
      orderBy('week', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWeeklyResults(snap.docs.map((d) => d.data() as WeeklyResult));
        setLoadingResults(false);
      },
      () => setLoadingResults(false)
    );
    return unsub;
  }, [leagueCode, isInSeason]);

  // Refresh current week on mount (once members are loaded).
  useEffect(() => {
    if (!isInSeason || !league || !currentWeek || members.length === 0) return;
    void doRefreshWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInSeason, currentWeek, members.length > 0 ? 1 : 0]);

  // Auto-poll every 60 s while current week is in_progress.
  useEffect(() => {
    if (!isInSeason || !currentWeek || !league) return;
    if (!currentResult || currentResult.status !== 'in_progress') return;

    const interval = setInterval(() => {
      const m = membersRef.current;
      if (league && currentWeek && m.length > 0) {
        refreshWeek(leagueCode, currentWeek, league, m).catch(console.error);
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [isInSeason, currentWeek, currentResult?.status, leagueCode, league]);

  async function doRefreshWeek() {
    if (!league || !currentWeek || members.length === 0) return;
    setRefreshing(true);
    setRefreshError('');
    try {
      await refreshWeek(leagueCode, currentWeek, league, members);
    } catch (err) {
      setRefreshError((err as Error).message ?? 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function doRefreshAll() {
    if (!league || members.length === 0) return;
    setRefreshAllProgress(0);
    setRefreshError('');
    try {
      // Sequential so rollover math stays correct.
      for (let w = 1; w <= 18; w++) {
        setRefreshAllProgress(w);
        await refreshWeek(leagueCode, w, league, members);
      }
    } catch (err) {
      setRefreshError((err as Error).message ?? 'Refresh failed');
    } finally {
      setRefreshAllProgress(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingProfile) {
    return <div className="py-12 text-slate-500 text-sm text-center">Loading…</div>;
  }

  if (!league) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-white">
          Welcome, <span className="text-amber-400">{firstName}</span>
        </h1>
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-sm mb-4">You're not in a league yet.</p>
          <a
            href="/create-league"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-6 py-2.5 rounded-full transition-all tracking-wide"
          >
            Create a League
          </a>
        </div>
      </div>
    );
  }

  // Pre-season: recruiting or assigned.
  if (!isInSeason) {
    return (
      <PreSeasonOverview
        firstName={firstName}
        league={league}
        leagueCode={leagueCode}
        isCommissioner={isCommissioner}
      />
    );
  }

  // In-season.
  const weeklyShare = computeWeeklyShare(league.seasonEntry, league.memberCount);
  const seasonPot = league.seasonEntry * league.memberCount;
  const currentPot = computePot(
    weeklyShare,
    currentResult?.rolloverFrom ?? 0
  );
  const standings = computeStandings(members, weeklyResults);
  const winCounts = teamWinCounts(weeklyResults);
  const seasonNotStarted = currentWeek === null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Welcome, <span className="text-amber-400">{firstName}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {league.name} · {league.season} Season
          </p>
        </div>
        {/* Manual refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCommissioner && (
            <button
              type="button"
              onClick={doRefreshAll}
              disabled={refreshAllProgress !== null || refreshing}
              title="Refresh all 18 weeks from ESPN"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 text-slate-400 hover:text-white hover:border-white/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {refreshAllProgress !== null
                ? `Refreshing ${refreshAllProgress}/18…`
                : 'Refresh All Weeks'}
            </button>
          )}
          {!seasonNotStarted && (
            <button
              type="button"
              onClick={doRefreshWeek}
              disabled={refreshing || refreshAllProgress !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 text-slate-300 hover:text-white hover:border-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                '↻'
              )}
              Refresh scores
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{refreshError}</span>
          <button
            onClick={() => setRefreshError('')}
            className="ml-3 text-red-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Season hasn't started yet (locked but pre-kickoff) ── */}
      {seasonNotStarted && (
        <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-white font-semibold mb-1">Season locked ✓</p>
          <p className="text-slate-400 text-sm">
            Scores will appear here when Week 1 kicks off
            {league.season === 2026 ? ' (September 10, 2026)' : ''}.
          </p>
        </div>
      )}

      {/* ── Pot summary ── */}
      {league.seasonEntry > 0 && (
        <PotSummaryCard
          seasonPot={seasonPot}
          weeklyShare={weeklyShare}
          currentPot={currentPot}
          rolloverFrom={currentResult?.rolloverFrom ?? 0}
          currentWeek={currentWeek}
        />
      )}

      {/* ── My Teams ── */}
      {myMember && (
        <MyTeamsCard
          member={myMember}
          weeklyResults={weeklyResults}
          winCounts={winCounts}
          isInSeason={isInSeason}
        />
      )}

      {/* ── This Week ── */}
      {currentWeek && (
        <ThisWeekCard
          week={currentWeek}
          result={currentResult}
          members={members}
          loading={loadingResults && !currentResult}
          refreshing={refreshing}
        />
      )}

      {/* ── Standings ── */}
      {standings.length > 0 && (
        <StandingsCard standings={standings} />
      )}

      {/* ── Past Weeks ── */}
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

// ─── Pre-season overview ──────────────────────────────────────────────────────

function PreSeasonOverview({
  firstName,
  league,
  leagueCode,
  isCommissioner,
}: {
  firstName: string;
  league: League;
  leagueCode: string;
  isCommissioner: boolean;
}) {
  const statusLabel =
    league.status === 'assigned'
      ? 'Teams assigned — ready to lock'
      : 'Recruiting members';

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-white">
        Welcome, <span className="text-amber-400">{firstName}</span>
      </h1>

      <div className="bg-navy-950/60 border border-amber-500/20 rounded-2xl p-6">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your League</p>
        <p className="text-xl font-bold text-white mb-1">{league.name}</p>
        <p className="font-mono text-amber-400 tracking-[0.3em] text-sm mb-3">
          {leagueCode}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400/60 flex-shrink-0" />
          {statusLabel}
          <span className="text-slate-600">·</span>
          {league.memberCount} member{league.memberCount === 1 ? '' : 's'}
          {league.seasonEntry > 0 && (
            <>
              <span className="text-slate-600">·</span>
              {fmtDollars(league.seasonEntry)} entry
            </>
          )}
        </div>
      </div>

      <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">🏈</p>
        <p className="text-white font-semibold mb-1">Season hasn't started yet</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          {isCommissioner
            ? league.status === 'recruiting'
              ? 'Invite members, then assign teams on the Teams tab. Lock the league when everyone is ready.'
              : 'Teams are assigned. Head to the Teams tab to make adjustments, then lock the league to begin the season.'
            : 'Hang tight — the commissioner will lock the league and start the season soon.'}
        </p>
      </div>
    </div>
  );
}

// ─── Pot summary ──────────────────────────────────────────────────────────────

function PotSummaryCard({
  seasonPot,
  weeklyShare,
  currentPot,
  rolloverFrom,
  currentWeek,
}: {
  seasonPot: number;
  weeklyShare: number;
  currentPot: number;
  rolloverFrom: number;
  currentWeek: number | null;
}) {
  return (
    <div className="bg-navy-950/60 border border-amber-500/10 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Pot Summary</p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-extrabold text-white">{fmtDollars(seasonPot)}</p>
          <p className="text-xs text-slate-500 mt-1">Season Pot</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-white">{fmtDollars(weeklyShare)}</p>
          <p className="text-xs text-slate-500 mt-1">Weekly Share</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-amber-400">{fmtDollars(currentPot)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {currentWeek ? `Week ${currentWeek} Pot` : 'Current Pot'}
          </p>
          {rolloverFrom > 0 && (
            <p className="text-xs text-amber-500/70 mt-0.5">
              +{fmtDollars(rolloverFrom)} rollover
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Teams ─────────────────────────────────────────────────────────────────

function MyTeamsCard({
  member,
  winCounts,
}: {
  member: MemberWithId;
  weeklyResults: WeeklyResult[];
  winCounts: Record<string, number>;
  isInSeason: boolean;
}) {
  const teams = member.teams ?? [];

  return (
    <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Your Teams</p>
      {teams.length === 0 ? (
        <p className="text-slate-500 text-sm italic">
          No teams assigned yet. Check back after the commissioner assigns teams.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {teams.map((abbr) => {
            const team = TEAM_BY_ABBR[abbr];
            const wins = winCounts[abbr] ?? 0;
            return (
              <div
                key={abbr}
                className="flex items-center gap-3 bg-navy-950/50 border border-white/5 rounded-xl px-3 py-2.5"
              >
                <TeamLogo abbr={abbr} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">
                    {team?.fullName ?? abbr}
                  </p>
                  <p className="text-xs text-slate-500">
                    {wins === 0
                      ? '0 wins this season'
                      : `${wins} win${wins === 1 ? '' : 's'} this season`}
                  </p>
                </div>
                {wins > 0 && (
                  <span className="text-amber-400 text-sm flex-shrink-0">🏆</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── This Week ────────────────────────────────────────────────────────────────

function ThisWeekCard({
  week,
  result,
  members,
  loading,
  refreshing,
}: {
  week: number;
  result: WeeklyResult | null;
  members: MemberWithId[];
  loading: boolean;
  refreshing: boolean;
}) {
  return (
    <div className="bg-navy-950/60 border border-white/10 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <p className="text-white font-bold">Week {week}</p>
          {result && <StatusPill status={result.status} />}
        </div>
        {result && result.rolloverFrom > 0 && (
          <p className="text-xs text-amber-400">
            Pot: {fmtDollars(result.weeklyShare + result.rolloverFrom)} (incl. {fmtDollars(result.rolloverFrom)} rollover)
          </p>
        )}
        {refreshing && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <span className="inline-block w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
            Refreshing…
          </span>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-slate-500 text-sm">
          Loading scores…
        </div>
      ) : !result ? (
        <div className="px-5 py-8 text-center text-slate-500 text-sm">
          No score data yet — click Refresh scores to load.
        </div>
      ) : (
        <>
          {/* Winner / rollover banner */}
          <WinnerBanner result={result} members={members} />

          {/* Game cards */}
          <div className="p-4">
            {result.status === 'in_progress' && (
              <p className="text-xs text-slate-500 mb-3 text-center">
                Live scores · auto-refreshing every 60 s
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.games.map((game) => (
                <GameCard key={game.espnGameId} game={game} members={members} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Winner banner ────────────────────────────────────────────────────────────

function WinnerBanner({
  result,
  members,
}: {
  result: WeeklyResult;
  members: MemberWithId[];
}) {
  if (result.status === 'in_progress') return null;

  if (result.status === 'rolled_over') {
    return (
      <div className="mx-4 mt-4 bg-navy-800/60 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xl flex-shrink-0">🎲</span>
        <div>
          <p className="text-sm font-semibold text-white">No 19-point score — pot rolls over!</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {fmtDollars(result.weeklyShare + result.rolloverFrom)} carries into next week.
          </p>
        </div>
      </div>
    );
  }

  // final with winners
  if (result.status === 'final' && result.winningMemberIds.length > 0) {
    const winnerNames = result.winningMemberIds.map((id) => {
      const m = members.find((x) => x.id === id);
      return m?.name ?? m?.email ?? 'Unknown';
    });
    const split = winnerNames.length > 1;
    return (
      <div className="mx-4 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
          🏆 {split ? 'Split Pot — ' : ''}19-Point Winner{split ? 's' : ''}!
        </p>
        {winnerNames.map((name, i) => (
          <p key={i} className="text-white font-semibold">
            {name}
            <span className="text-green-400 font-normal text-sm ml-2">
              {split ? 'splits ' : 'wins '}
              {fmtDollars(result.weeklyShare + result.rolloverFrom)}
            </span>
            {split && (
              <span className="text-slate-400 text-xs ml-1">
                ({fmtDollars(result.payoutPerWinner)} each)
              </span>
            )}
          </p>
        ))}
      </div>
    );
  }

  return null;
}

// ─── Game card ────────────────────────────────────────────────────────────────

function GameCard({
  game,
  members,
}: {
  game: GameResult;
  members: MemberWithId[];
}) {
  const homeIs19 = game.status === 'final' && game.homeScore === 19;
  const awayIs19 = game.status === 'final' && game.awayScore === 19;

  const homeOwner = members.find((m) => m.teams.includes(game.homeAbbr));
  const awayOwner = members.find((m) => m.teams.includes(game.awayAbbr));

  const statusLabel =
    game.status === 'final'
      ? 'Final'
      : game.status === 'in_progress'
      ? 'Live'
      : fmtGameTime(game.startsAt);

  return (
    <div
      className={`rounded-xl border p-3 ${
        homeIs19 || awayIs19
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-white/5 bg-navy-950/50'
      }`}
    >
      {/* Status */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-xs font-semibold ${
            game.status === 'in_progress'
              ? 'text-red-400'
              : game.status === 'final'
              ? 'text-slate-400'
              : 'text-slate-500'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Away team */}
      <TeamScoreRow
        abbr={game.awayAbbr}
        score={game.awayScore}
        is19={awayIs19}
        owner={awayOwner}
        showScore={game.status !== 'scheduled'}
      />
      {/* Home team */}
      <TeamScoreRow
        abbr={game.homeAbbr}
        score={game.homeScore}
        is19={homeIs19}
        owner={homeOwner}
        showScore={game.status !== 'scheduled'}
      />
    </div>
  );
}

function TeamScoreRow({
  abbr,
  score,
  is19,
  owner,
  showScore,
}: {
  abbr: string;
  score: number;
  is19: boolean;
  owner: MemberWithId | undefined;
  showScore: boolean;
}) {
  const team = TEAM_BY_ABBR[abbr];

  return (
    <div className="flex items-center gap-2 py-1">
      <TeamLogo abbr={abbr} size={22} />
      <span className="text-white text-xs font-semibold flex-1 truncate">
        {team?.name ?? abbr}
      </span>
      {owner ? (
        <span className="text-xs text-slate-500 truncate max-w-[5rem]" title={owner.name}>
          {owner.name.split(' ')[0]}
        </span>
      ) : (
        <span className="text-xs text-slate-700 italic">unowned</span>
      )}
      {showScore && (
        <span
          className={`font-mono font-bold text-sm w-6 text-right flex-shrink-0 ${
            is19 ? 'text-amber-400' : 'text-white'
          }`}
        >
          {is19 ? '🏆' : score}
        </span>
      )}
    </div>
  );
}

// ─── Standings ────────────────────────────────────────────────────────────────

function StandingsCard({ standings }: { standings: MemberStats[] }) {
  const hasAnyWins = standings.some((s) => s.wins > 0);

  return (
    <div className="bg-navy-950/60 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <p className="text-white font-bold">Season Standings</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {hasAnyWins ? 'Based on completed weeks' : 'No winners yet this season'}
        </p>
      </div>
      <div className="divide-y divide-white/5">
        {standings.map((s, i) => (
          <StandingsRow key={s.member.id} rank={i + 1} stats={s} />
        ))}
      </div>
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
      <span className="text-slate-600 text-xs w-5 text-right flex-shrink-0">
        {rank}
      </span>
      <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">
          {member.name || member.email}
        </p>
        <div className="flex flex-wrap gap-0.5 mt-0.5">
          {(member.teams ?? []).slice(0, 6).map((abbr) => (
            <span
              key={abbr}
              className="text-[10px] font-mono text-slate-500 border border-white/5 px-1 rounded"
            >
              {abbr}
            </span>
          ))}
          {(member.teams ?? []).length > 6 && (
            <span className="text-[10px] text-slate-600">
              +{(member.teams ?? []).length - 6}
            </span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${totalWon > 0 ? 'text-green-400' : 'text-slate-600'}`}>
          {fmtDollars(totalWon)}
        </p>
        <p className="text-xs text-slate-500">
          {wins} win{wins === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

// ─── Past Weeks ───────────────────────────────────────────────────────────────

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
        <span className="text-slate-500 text-sm w-14 flex-shrink-0">Week {result.week}</span>
        <StatusPill status={result.status} small />
      </div>
      <div className="text-right flex-1 min-w-0">
        {result.status === 'rolled_over' ? (
          <p className="text-slate-500 text-xs">No winner — pot rolled over</p>
        ) : winnerNames.length > 0 ? (
          <p className="text-xs text-green-400 truncate">
            🏆 {winnerNames.join(', ')}
            <span className="text-slate-500 ml-1">· {fmtDollars(result.payoutPerWinner)} each</span>
          </p>
        ) : (
          <p className="text-slate-500 text-xs">—</p>
        )}
      </div>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({
  status,
  small = false,
}: {
  status: WeeklyResult['status'] | 'in_progress' | 'final' | 'rolled_over';
  small?: boolean;
}) {
  const configs: Record<string, { label: string; cls: string }> = {
    in_progress: { label: 'Live', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    final: { label: 'Final', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    rolled_over: { label: 'Rolled over', cls: 'bg-slate-700/40 text-slate-400 border-slate-600/30' },
  };
  const cfg = configs[status] ?? { label: status, cls: 'bg-white/5 text-slate-400 border-white/10' };
  return (
    <span
      className={`inline-block rounded-full border font-semibold ${
        small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      } ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Team logo ────────────────────────────────────────────────────────────────

function TeamLogo({ abbr, size }: { abbr: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const url = `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;

  if (failed) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-[9px] font-bold text-slate-400 bg-white/5 rounded flex-shrink-0"
      >
        {abbr}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={abbr}
      width={size}
      height={size}
      className="object-contain flex-shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
