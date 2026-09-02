import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { LeagueModePill } from '../../components/LeagueMode';
import { db } from '../../lib/firebase';
import {
  fetchEspnWeek,
  getCurrentNFLWeek,
  getEffectiveSeason,
  isBeforeSeasonStart,
} from '../../lib/espn';
import { earliestKickoffMs } from '../../lib/reshuffleCore';
import { membersCollectionRef, sortMembers } from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import {
  computeWeeklyShareFromPot,
  getSeasonPot,
} from '../../lib/scoring';
import { refreshWeek } from '../../lib/scoringWriter';
import { TEAM_BY_ABBR } from '../../lib/teams';
import { normalizeWeeklyResult } from '../../lib/types';
import type {
  GameResult,
  League,
  OwnershipSnapshot,
  WeeklyResult,
} from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  firstName: string;
  league: League | null;
  leagueCode: string;
  loadingProfile: boolean;
  userId: string;
  isCommissioner: boolean;
  onGoToMembers?: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Kickoff time of the season's first game, taken from ESPN week 1. Only
 * fetched before the season starts, which is the only time a countdown makes
 * sense. A failure leaves the countdown hidden rather than blocking the view.
 */
function useFirstKickoff(season: number, enabled: boolean): number | null {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMs(null);
      return;
    }
    let cancelled = false;
    fetchEspnWeek(getEffectiveSeason(season), 1)
      .then((games) => {
        if (!cancelled) setMs(earliestKickoffMs(games));
      })
      .catch(() => {
        // Non-critical. No countdown beats an error banner here.
      });
    return () => {
      cancelled = true;
    };
  }, [season, enabled]);

  return ms;
}

// ─── Kickoff countdown ────────────────────────────────────────────────────────

function KickoffCountdown({ kickoffMs }: { kickoffMs: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = kickoffMs - now;
  if (remaining <= 0) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const parts = [
    { label: 'days', value: Math.floor(totalSeconds / 86400) },
    { label: 'hrs', value: Math.floor((totalSeconds % 86400) / 3600) },
    { label: 'min', value: Math.floor((totalSeconds % 3600) / 60) },
    { label: 'sec', value: totalSeconds % 60 },
  ];

  return (
    <div>
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        {parts.map((p) => (
          <div key={p.label} className="text-center">
            {/* tabular-nums keeps the digits from jittering as they tick. */}
            <p className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums leading-none">
              {String(p.value).padStart(2, '0')}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1.5">
              {p.label}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-4">
        First kickoff{' '}
        {new Date(kickoffMs).toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}

// ─── Season underway but unlocked ─────────────────────────────────────────────

/**
 * The failure this exists for: a commissioner never locks, the season starts,
 * and nothing is scored. Both scoringWriter and the Firestore rules refuse to
 * write weeklyResults outside 'in_season', so the pool silently does not run.
 * Without this the dashboard kept saying "Season hasn't started yet", which is
 * false once kickoff has passed.
 */
function UnlockedSeasonWarning({
  week,
  isCommissioner,
}: {
  week: number;
  isCommissioner: boolean;
}) {
  const finished = week - 1;

  return (
    <div className="bg-hot-dim border border-hot/40 rounded-2xl p-6">
      <p className="text-hot font-semibold mb-2">
        ⚠️ The season is underway and this league is not locked
      </p>
      <p className="text-ink-dim text-sm leading-relaxed">
        Week {week} is in progress. Results are only recorded once the league is
        locked, so nothing from this season has been scored.
        {finished > 0 && (
          <>
            {' '}
            {finished === 1
              ? 'Week 1 has already finished'
              : `Weeks 1 through ${finished} have already finished`}{' '}
            without being recorded.
          </>
        )}
      </p>
      <p className="text-ink-dim text-sm leading-relaxed mt-3">
        {isCommissioner
          ? 'Lock the league on the Teams tab to start recording results. You can refresh past weeks afterward, but they would be scored against rosters assigned after those games were played.'
          : 'Your commissioner needs to lock the league before any results are recorded.'}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeeklyResultsTab({
  firstName,
  league,
  leagueCode,
  loadingProfile,
  userId,
  isCommissioner,
  onGoToMembers,
}: Props) {
  const [weeklyResults, setWeeklyResults] = useState<WeeklyResult[]>([]);
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshAllProgress, setRefreshAllProgress] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState('');

  // Stable ref so poll closure doesn't capture stale members.
  const membersRef = useRef<MemberWithId[]>([]);
  membersRef.current = members;

  // Countdown for a locked league still waiting on kickoff. Declared here with
  // the other hooks because the render below returns early in several places.
  const beforeKickoff = !!league && isBeforeSeasonStart(league.season);
  const firstKickoffMs = useFirstKickoff(league?.season ?? 0, beforeKickoff);

  const isInSeason = league?.status === 'in_season';
  const currentWeek = league ? getCurrentNFLWeek(league.season) : null;
  const currentResult = weeklyResults.find((r) => r.week === currentWeek) ?? null;
  const myMember = members.find((m) => m.uid === userId) ?? null;

  // User-selected week for browsing. null → follow the live "current" week.
  // Polling still fires against currentWeek regardless — the user viewing
  // a past week shouldn't interrupt the live-scoring loop.
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const activeWeek = selectedWeek ?? currentWeek;
  const activeResult =
    activeWeek != null
      ? (weeklyResults.find((r) => r.week === activeWeek) ?? null)
      : null;

  // Payout for the ACTIVE week: fetched share + accumulated rollover when
  // that week's doc exists; otherwise fall back to the base share so we
  // display something meaningful even before the week's been refreshed.
  const baseWeeklyShare = league
    ? computeWeeklyShareFromPot(getSeasonPot(league))
    : 0;
  const activeWeeklyPot = activeResult
    ? activeResult.weeklyShare + activeResult.rolloverFrom
    : baseWeeklyShare;

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
        setWeeklyResults(
          snap.docs.map((d) =>
            normalizeWeeklyResult(d.data() as Record<string, unknown>)
          )
        );
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
    // Refresh whichever week the user is currently viewing — not necessarily
    // the live one — so the dropdown + refresh button work together.
    const wk = activeWeek;
    if (!league || !wk || members.length === 0) return;
    setRefreshing(true);
    setRefreshError('');
    try {
      await refreshWeek(leagueCode, wk, league, members);
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
        onGoToMembers={onGoToMembers}
      />
    );
  }

  // In-season.
  // Same pre-kickoff clip Standings applies. A league locked before the season
  // starts can already hold stored results, from an early lock or from test
  // data, and none of those weeks have actually been played yet.
  const winCounts = isBeforeSeasonStart(league.season)
    ? {}
    : teamWinCounts(weeklyResults);
  const seasonNotStarted = currentWeek === null;

  return (
    <div className="space-y-6">
      {/* Header — title left, weekly-pot callout right (matches legacy) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Weekly Results
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-2">
            <span>{league.season} Season</span>
            <LeagueModePill mode={league.mode} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-green-400 font-semibold">
            This Week's Pot
          </p>
          <p className="text-3xl font-extrabold text-amber-400 leading-tight">
            {fmtDollars(activeWeeklyPot)}
          </p>
        </div>
      </div>

      {/* Filter row — week dropdown left, refresh actions right */}
      {!seasonNotStarted && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 bg-navy-950/60 border border-white/10 rounded-xl px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
              Week
            </span>
            <select
              value={activeWeek ?? 1}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer pr-1"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w} className="bg-navy-900">
                  Week {w}
                  {w === currentWeek ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>

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
              Refresh
            </button>
          </div>
        </div>
      )}

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
            Scores will appear here when Week 1 kicks off.
          </p>
          {beforeKickoff && firstKickoffMs !== null && (
            <div className="mt-5 pt-5 border-t border-white/5">
              <KickoffCountdown kickoffMs={firstKickoffMs} />
            </div>
          )}
        </div>
      )}

      {/* ── This Week (or the selected week) ── */}
      {activeWeek && (
        <ThisWeekCard
          week={activeWeek}
          result={activeResult}
          members={members}
          loading={loadingResults && !activeResult}
          refreshing={refreshing}
        />
      )}

      {/* ── My Teams (below the scores) ── */}
      {myMember && (
        <MyTeamsCard
          member={myMember}
          weeklyResults={weeklyResults}
          winCounts={winCounts}
          isInSeason={isInSeason}
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
  onGoToMembers,
}: {
  firstName: string;
  league: League;
  leagueCode: string;
  isCommissioner: boolean;
  onGoToMembers?: () => void;
}) {
  const statusLabel =
    league.status === 'assigned'
      ? 'Teams assigned — ready to lock'
      : 'Recruiting players';

  // getCurrentNFLWeek returns null both before a season starts and after it
  // ends, so isBeforeSeasonStart is what separates "not yet" from "underway".
  const preSeason = isBeforeSeasonStart(league.season);
  const currentWeek = getCurrentNFLWeek(league.season);
  const seasonUnderway = !preSeason && currentWeek !== null;
  const firstKickoffMs = useFirstKickoff(league.season, preSeason);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-white">
        Welcome, <span className="text-amber-400">{firstName}</span>
      </h1>

      <div className="bg-navy-950/60 border border-amber-500/20 rounded-2xl p-6">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your League</p>
        <p className="text-xl font-bold text-white mb-1">
          {league.name} <LeagueModePill mode={league.mode} />
        </p>
        <p className="font-mono text-amber-400 tracking-[0.3em] text-sm mb-3">
          {leagueCode}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400/60 flex-shrink-0" />
          {statusLabel}
          <span className="text-slate-600">·</span>
          {league.memberCount} player{league.memberCount === 1 ? '' : 's'}
          {league.seasonEntry > 0 && (
            <>
              <span className="text-slate-600">·</span>
              {fmtDollars(league.seasonEntry)} entry
            </>
          )}
        </div>
      </div>

      {seasonUnderway && currentWeek !== null ? (
        <UnlockedSeasonWarning week={currentWeek} isCommissioner={isCommissioner} />
      ) : null}

      <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">🏈</p>
        <p className="text-white font-semibold mb-1">
          {seasonUnderway ? 'This league is not scoring' : "Season hasn't started yet"}
        </p>
        <p className="text-slate-400 text-sm leading-relaxed">
          {isCommissioner
            ? league.status === 'recruiting'
              ? 'Invite players, then assign teams on the Teams tab. Lock the league when everyone is ready.'
              : 'Teams are assigned. Head to the Teams tab to make adjustments, then lock the league to begin the season.'
            : 'Hang tight — the commissioner will lock the league and start the season soon.'}
        </p>

        {preSeason && firstKickoffMs !== null && (
          <div className="mt-5 pt-5 border-t border-white/5">
            <KickoffCountdown kickoffMs={firstKickoffMs} />
          </div>
        )}
        {isCommissioner && league.status === 'recruiting' && onGoToMembers && (
          <button
            type="button"
            onClick={onGoToMembers}
            className="mt-4 bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 px-6 rounded-xl transition-all tracking-wide"
          >
            Invite Players
          </button>
        )}
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

// ─── Owner lookup ─────────────────────────────────────────────────────────────

/**
 * Resolve a team's owner for a given week. Prefers the week's frozen ownership
 * snapshot so a past week keeps showing who actually held the team then, even
 * after a roster change or a Roulette reshuffle. Falls back to live ownership
 * when the snapshot is empty, which covers docs written before snapshots
 * shipped and weeks that have not been refreshed yet.
 */
function makeOwnerLookup(
  ownership: OwnershipSnapshot,
  members: MemberWithId[]
): (abbr: string) => string | null {
  const hasSnapshot = Object.keys(ownership).length > 0;

  if (!hasSnapshot) {
    return (abbr) => members.find((m) => m.teams.includes(abbr))?.name ?? null;
  }

  const nameById = new Map(members.map((m) => [m.id, m.name || m.email]));
  const ownerByTeam = new Map<string, string>();
  for (const [memberId, teams] of Object.entries(ownership)) {
    for (const abbr of teams) {
      // A snapshotted member who has since been removed no longer resolves to
      // a name, so label the slot rather than showing the team as unowned.
      ownerByTeam.set(abbr, nameById.get(memberId) ?? 'Former player');
    }
  }
  return (abbr) => ownerByTeam.get(abbr) ?? null;
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
      {/* Card header — pot amount lives in the top-of-page callout, so this
          row just anchors the week + status. */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <p className="text-white font-bold">Week {week}</p>
          {result && <StatusPill status={result.status} />}
        </div>
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
                <GameCard
                  key={game.espnGameId}
                  game={game}
                  ownerFor={makeOwnerLookup(result.ownership, members)}
                />
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
              wins {fmtDollars(result.payoutPerWinner)}
            </span>
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
  ownerFor,
}: {
  game: GameResult;
  ownerFor: (abbr: string) => string | null;
}) {
  const homeIs19 = game.status === 'final' && game.homeScore === 19;
  const awayIs19 = game.status === 'final' && game.awayScore === 19;

  const homeOwner = ownerFor(game.homeAbbr);
  const awayOwner = ownerFor(game.awayAbbr);

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
  owner: string | null;
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
        <span className="text-xs text-slate-500 truncate max-w-[5rem]" title={owner}>
          {owner.split(' ')[0]}
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
          {score}
        </span>
      )}
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
