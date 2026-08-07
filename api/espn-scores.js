// ESPN scoreboard proxy — avoids CORS restrictions when called from the browser.
// Usage: GET /api/espn-scores?season=2026&week=1
//
// Backing endpoint: sports.core.api.espn.com. The old site.api.espn.com/.../
// scoreboard endpoint that used to return a full week in one call is now
// 403-blocked by Akamai for both browsers and Vercel functions. The core
// API is still reachable but structured as $ref links — we fan out the
// hydration here so the client-facing shape stays identical to before.
//
// Per week: 1 list request + N event requests + N × (1 status + 2 score)
// sub-requests. For a typical 16-game week that's ~65 total sub-requests,
// almost all parallel. Wall time is dominated by the slowest chain
// (~500-800ms) rather than the sum. Kept simple: any per-event failure
// drops that one game; the rest still return.

const BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const UA = 'Mozilla/5.0 (compatible; 19Pool/1.0)';

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

/**
 * Hydrate one event into the site.api scoreboard shape the client normalizer
 * already parses (see src/lib/espn.ts normalizeEvent). We omit `team.abbreviation`
 * — client falls back to `team.id` via ESPN_ID_TO_ABBR, which covers all 32.
 */
async function hydrateEvent(eventRef) {
  const event = await fetchJson(eventRef);
  const comp = event.competitions?.[0];
  if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length !== 2) {
    return null;
  }

  // Fetch status + both competitor scores in parallel. Any failure fails the
  // whole event (better to drop than to serve zeros silently).
  const [status, ...scores] = await Promise.all([
    fetchJson(comp.status.$ref),
    ...comp.competitors.map((c) => fetchJson(c.score.$ref)),
  ]);

  return {
    id: event.id,
    date: event.date,
    status: { type: status.type },
    competitions: [
      {
        id: comp.id,
        date: comp.date,
        status: { type: status.type },
        competitors: comp.competitors.map((c, i) => ({
          id: c.id,
          homeAway: c.homeAway,
          winner: c.winner,
          team: {
            id: c.id,
            // Leave abbreviation empty; the client resolveAbbr() falls back to
            // team.id via ESPN_ID_TO_ABBR (mapped in src/lib/teams.ts).
            abbreviation: '',
            displayName: '',
          },
          score: String(scores[i]?.value ?? 0),
        })),
      },
    ],
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { season, week } = req.query;
  if (!season || !week) {
    return res.status(400).json({ error: 'season and week query params are required.' });
  }

  const numSeason = Number(season);
  const numWeek = Number(week);
  if (
    !Number.isFinite(numSeason) ||
    !Number.isFinite(numWeek) ||
    numWeek < 1 ||
    numWeek > 18
  ) {
    return res.status(400).json({ error: 'Invalid season or week value.' });
  }

  try {
    // 1. List all event refs for this week (regular season = seasontype 2).
    const listUrl = `${BASE}/seasons/${numSeason}/types/2/weeks/${numWeek}/events`;
    const list = await fetchJson(listUrl);
    const refs = Array.isArray(list.items)
      ? list.items.map((it) => it.$ref).filter(Boolean)
      : [];

    if (refs.length === 0) {
      // Off-season or empty week — the site.api used to return {} with no
      // events; preserve that so the client's `!Array.isArray(events)` guard
      // treats it as "no games".
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ events: [] });
    }

    // 2. Hydrate every event in parallel. Drop failures (returns null →
    //    filter). One bad game shouldn't nuke the whole week.
    const settled = await Promise.all(
      refs.map((ref) =>
        hydrateEvent(ref).catch((err) => {
          console.warn('[espn-scores] event hydrate failed:', err.message);
          return null;
        })
      )
    );
    const events = settled.filter((e) => e !== null);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ events });
  } catch (err) {
    console.error('[espn-scores] top-level failure:', err);
    return res
      .status(500)
      .json({ error: err.message || 'Failed to fetch from ESPN' });
  }
}
