import { TEAM_BY_ABBR, ESPN_ID_TO_ABBR } from './teams';
import type { GameResult, GameStatus } from './types';

// ─── Test-mode overrides ──────────────────────────────────────────────────────
// Set VITE_TEST_SEASON (e.g. "2025") to fetch historical ESPN data instead of
// the real current year — lets us dry-run the mid-season UI before real 2026
// games exist. VITE_TEST_CURRENT_WEEK pins the "current week" so we can
// simulate any week mid-season. Both leave unset = normal behavior.

type ViteEnv = {
  VITE_TEST_SEASON?: string;
  VITE_TEST_CURRENT_WEEK?: string;
};

// Vite injects import.meta.env into the browser bundle. The reshuffle cron
// bundles this module for Node, where import.meta.env does not exist at all,
// and a bare property read would throw on the first call. Read it defensively
// so the same module is safe in both runtimes. Server side there are no VITE_
// vars by design, so test mode is simply off there.
function viteEnv(): ViteEnv {
  return (import.meta as unknown as { env?: ViteEnv }).env ?? {};
}

/** Returns the overridden season year, or null when unset/invalid. */
export function getTestSeason(): number | null {
  const raw = viteEnv().VITE_TEST_SEASON;
  if (!raw) return null;
  const year = parseInt(raw, 10);
  return Number.isFinite(year) && year > 2000 ? year : null;
}

/** Returns the pinned "current week", or null when unset/invalid. */
export function getTestCurrentWeek(): number | null {
  const raw = viteEnv().VITE_TEST_CURRENT_WEEK;
  if (!raw) return null;
  const week = parseInt(raw, 10);
  return Number.isFinite(week) && week >= 1 && week <= 18 ? week : null;
}

/** True when the season override is active. */
export function isTestMode(): boolean {
  return getTestSeason() !== null;
}

/**
 * Returns the season to actually fetch for. Wrap this at every ESPN call site
 * that would otherwise pass a league's declared season, so historical data is
 * served in test mode. Keeps fetchEspnWeek honest — it still takes any year.
 */
export function getEffectiveSeason(realSeason: number): number {
  return getTestSeason() ?? realSeason;
}

// ─── ESPN response shape ──────────────────────────────────────────────────────
// These are the fields we actually use — ESPN's full response has many more.

type EspnStatusType = {
  state: 'pre' | 'in' | 'post';
  detail: string;
};

type EspnStatus = {
  type: EspnStatusType;
};

type EspnTeam = {
  id: string;
  abbreviation: string;
  displayName: string;
};

type EspnCompetitor = {
  id: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  team: EspnTeam;
  score: string;
};

type EspnCompetition = {
  id: string;
  date: string;
  competitors: EspnCompetitor[];
  status: EspnStatus;
};

type EspnEvent = {
  id: string;
  date: string;
  competitions: EspnCompetition[];
  status: EspnStatus;
};

type EspnScoreboardResponse = {
  events?: EspnEvent[];
};

// ─── Normalization helpers ────────────────────────────────────────────────────

/** Resolve an ESPN team to our canonical abbreviation. Throws if unknown. */
function resolveAbbr(team: EspnTeam): string {
  // Primary: ESPN abbreviations match our abbr values for all 32 teams.
  if (TEAM_BY_ABBR[team.abbreviation]) return team.abbreviation;
  // Fallback: match by ESPN numeric ID (espnId field).
  const byId = ESPN_ID_TO_ABBR[team.id];
  if (byId) return byId;
  throw new Error(
    `Unknown ESPN team: abbreviation="${team.abbreviation}" id="${team.id}"`
  );
}

function normalizeState(state: string): GameStatus {
  if (state === 'in') return 'in_progress';
  if (state === 'post') return 'final';
  return 'scheduled';
}

function normalizeEvent(ev: EspnEvent): GameResult | null {
  const comp = ev.competitions?.[0];
  if (!comp) {
    console.warn('[espn] event has no competitions:', ev.id);
    return null;
  }

  const competitors = comp.competitors;
  if (!Array.isArray(competitors) || competitors.length !== 2) {
    console.warn('[espn] unexpected competitors count for event', ev.id);
    return null;
  }

  const home = competitors.find((c) => c.homeAway === 'home');
  const away = competitors.find((c) => c.homeAway === 'away');
  if (!home || !away) {
    console.warn('[espn] cannot identify home/away for event', ev.id);
    return null;
  }

  let homeAbbr: string;
  let awayAbbr: string;
  try {
    homeAbbr = resolveAbbr(home.team);
    awayAbbr = resolveAbbr(away.team);
  } catch (err) {
    console.warn('[espn]', (err as Error).message, '— skipping game', ev.id);
    return null;
  }

  const state = ev.status?.type?.state;
  if (!state) {
    console.warn('[espn] event missing status.type.state:', ev.id);
    return null;
  }

  // Scores are empty strings pre-game — treat as 0 without warning.
  const homeScore = parseInt(home.score, 10);
  const awayScore = parseInt(away.score, 10);
  if (state !== 'pre' && (!Number.isFinite(homeScore) || !Number.isFinite(awayScore))) {
    console.warn('[espn] non-finite score during/after game', ev.id, {
      homeScore: home.score,
      awayScore: away.score,
      state,
    });
  }

  return {
    espnGameId: ev.id,
    homeAbbr,
    awayAbbr,
    homeScore: Number.isFinite(homeScore) ? homeScore : 0,
    awayScore: Number.isFinite(awayScore) ? awayScore : 0,
    status: normalizeState(state),
    startsAt: ev.date ?? comp.date ?? '',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch and normalize ESPN scoreboard for a given week.
 * Routes through /api/espn-scores (Vercel proxy), which bypasses browser CORS
 * and hydrates the upstream response into the shape this normalizer expects.
 *
 * baseUrl is empty in the browser, where a relative URL is correct. The
 * reshuffle cron runs in Node, where fetch cannot parse a relative URL, so it
 * passes its own origin. Going through the proxy rather than straight to ESPN
 * keeps the hydration logic in one place.
 */
export async function fetchEspnWeek(
  season: number,
  week: number,
  baseUrl = ''
): Promise<GameResult[]> {
  const url = `${baseUrl}/api/espn-scores?season=${season}&week=${week}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error fetching ESPN data: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`ESPN proxy returned ${response.status}`);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error('ESPN proxy returned invalid JSON');
  }

  const data = raw as EspnScoreboardResponse;

  // Off-season or empty week — return [] rather than throwing.
  if (!Array.isArray(data.events)) return [];

  const results: GameResult[] = [];
  for (const ev of data.events) {
    const normalized = normalizeEvent(ev);
    if (normalized !== null) results.push(normalized);
  }

  return results;
}

/**
 * Returns the current NFL week (1-18), or null if outside the season.
 *
 * Season start dates are hardcoded. 2026: Thursday September 10, 2026.
 * Week advances every 7 days from the season start date.
 */
export function getCurrentNFLWeek(season: number, now = new Date()): number | null {
  // Test-mode short-circuit: if both season and week overrides are set, honor
  // the pinned week directly. Ignore the caller's season here — the test week
  // is a fixed simulation, not a per-league calculation.
  const testWeek = getTestCurrentWeek();
  if (testWeek !== null && isTestMode()) return testWeek;

  const SEASON_STARTS: Record<number, string> = {
    2024: '2024-09-05',
    2025: '2025-09-04',
    2026: '2026-09-10',
  };

  const startStr = SEASON_STARTS[season];
  if (!startStr) return null;

  // Use noon ET on the start date to handle timezone edge cases.
  const seasonStart = new Date(`${startStr}T12:00:00-05:00`);
  const seasonEnd = new Date(
    seasonStart.getTime() + 18 * 7 * 24 * 60 * 60 * 1000
  );

  if (now < seasonStart) return null; // pre-season
  if (now > seasonEnd) return null;   // post-season

  const msElapsed = now.getTime() - seasonStart.getTime();
  return Math.min(18, Math.max(1, Math.ceil(msElapsed / (7 * 24 * 60 * 60 * 1000))));
}
